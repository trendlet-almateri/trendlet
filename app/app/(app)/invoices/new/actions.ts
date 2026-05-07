"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createServiceClient } from "@/lib/supabase/server";

export type SubOrderSearchHit = {
  sub_order_id: string;
  sub_order_number: string;
  product_title: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  /** Discount allocated to this sub-order's matching Shopify line item.
   *  Pulled from raw_payload.line_items[].discount_allocations so admin
   *  doesn't lose the order-level discount when invoicing. */
  discount: number;
  currency: string;
  order_id: string;
  shopify_order_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
};

/**
 * Typeahead search for sub-orders by sub_order_number prefix or product title.
 * Returns up to 10 hits with enough info to pre-populate the invoice form.
 *
 * Auth: admin or any non-warehouse role (sourcing/EU also create invoices).
 */
export async function searchSubOrders(query: string): Promise<SubOrderSearchHit[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  // Warehouse can't create invoices.
  const allowed = user.roles.some((r) => r === "admin" || r === "sourcing" || r === "fulfiller");
  if (!allowed) return [];

  const q = query.trim();
  if (q.length < 2) return [];

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("sub_orders")
    .select(`
      id, sub_order_number, product_title, sku, quantity, unit_price, currency,
      shopify_line_item_id,
      order:orders (
        id, shopify_order_number, raw_payload,
        customer:customers ( id, first_name, last_name, email )
      )
    `)
    .or(`sub_order_number.ilike.%${q}%,product_title.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[searchSubOrders]", error);
    return [];
  }

  type Row = {
    id: string;
    sub_order_number: string;
    product_title: string;
    sku: string | null;
    quantity: number;
    unit_price: number | null;
    currency: string;
    shopify_line_item_id: string | null;
    order: {
      id: string;
      shopify_order_number: string;
      raw_payload: ShopifyOrderPayload | null;
      customer: {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      } | null;
    } | null;
  };

  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.order != null)
    .map((r) => {
      const cust = r.order!.customer;
      const name = cust ? [cust.first_name, cust.last_name].filter(Boolean).join(" ") : "";
      return {
        sub_order_id: r.id,
        sub_order_number: r.sub_order_number,
        product_title: r.product_title,
        sku: r.sku,
        quantity: r.quantity,
        unit_price: Number(r.unit_price ?? 0),
        discount: lineItemDiscount(r.order!.raw_payload, r.shopify_line_item_id),
        currency: r.currency,
        order_id: r.order!.id,
        shopify_order_number: r.order!.shopify_order_number,
        customer_id: cust?.id ?? null,
        customer_name: name || "—",
        customer_email: cust?.email ?? null,
      };
    });
}

/**
 * Sum of discount_allocations for a Shopify line item (in shop currency).
 * Returns 0 if no payload, no matching line, or no allocations.
 */
type ShopifyDiscountAlloc = { amount?: string | number };
type ShopifyLineItem = {
  id?: number | string;
  discount_allocations?: ShopifyDiscountAlloc[];
};
type ShopifyOrderPayload = {
  line_items?: ShopifyLineItem[];
};

function lineItemDiscount(
  rawPayload: ShopifyOrderPayload | null,
  lineItemId: string | null,
): number {
  if (!rawPayload || !lineItemId) return 0;
  const items = rawPayload.line_items;
  if (!Array.isArray(items)) return 0;
  const match = items.find((li) => String(li.id) === lineItemId);
  if (!match) return 0;
  const allocations = match.discount_allocations ?? [];
  const total = allocations.reduce((sum, a) => sum + Number(a.amount ?? 0), 0);
  return Number(total.toFixed(2));
}

/* ── create invoice ──────────────────────────────────────────────────── */

const CURRENCY = z.enum(["SAR", "USD", "EUR", "GBP", "AED"]);

const lineItemSchema = z.object({
  title: z.string().trim().min(1, "Item title is required."),
  sku: z.string().trim().optional().nullable(),
  quantity: z.coerce.number().int().positive(),
  unit_price: z.coerce.number().nonnegative(),
  sub_order_id: z.string().uuid().optional().nullable(),
});

const createSchema = z.object({
  order_id: z.string().uuid("Pick at least one sub-order."),
  sub_order_ids: z.array(z.string().uuid()).min(1, "Pick at least one sub-order."),
  language: z.enum(["en", "ar", "bilingual"]).default("en"),
  cost: z.coerce.number().nonnegative(),
  cost_currency: CURRENCY,
  markup_percent: z.coerce.number().nonnegative(),
  discount_amount: z.coerce.number().nonnegative().default(0),
  shipment_fee: z.coerce.number().nonnegative().default(0),
  tax_percent: z.coerce.number().nonnegative().default(0),
  total_currency: CURRENCY,
  items: z.array(lineItemSchema).min(1, "At least one line item is required."),
  submit_for_review: z.coerce.boolean().default(false),
});

export type CreateInvoiceState = {
  ok: boolean;
  error: string | null;
  invoiceId?: string;
};

/**
 * Create a customer invoice from one or more sub-orders.
 *
 * Status starts as 'draft'. If submit_for_review=true, lands as
 * 'pending_review' (visible in admin queue immediately).
 *
 * Aggregate financials (cost, markup, totals) live on customer_invoices
 * to match existing approval/PDF code; line items live in
 * customer_invoice_items.
 */
export async function createInvoiceAction(
  _prev: CreateInvoiceState,
  formData: FormData,
): Promise<CreateInvoiceState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const allowed = user.roles.some((r) => r === "admin" || r === "sourcing" || r === "fulfiller");
  if (!allowed) return { ok: false, error: "Not allowed to create invoices." };

  // Form encodes items as JSON in a single field — easier than indexed inputs
  // for a dynamic-length list.
  const itemsRaw = formData.get("items_json");
  let parsedItems: unknown = [];
  try {
    parsedItems = typeof itemsRaw === "string" ? JSON.parse(itemsRaw) : [];
  } catch {
    return { ok: false, error: "Invalid line items payload." };
  }

  const subOrdersRaw = formData.get("sub_order_ids_json");
  let parsedSubOrderIds: unknown = [];
  try {
    parsedSubOrderIds = typeof subOrdersRaw === "string" ? JSON.parse(subOrdersRaw) : [];
  } catch {
    return { ok: false, error: "Invalid sub-order selection." };
  }

  const parsed = createSchema.safeParse({
    order_id: formData.get("order_id"),
    sub_order_ids: parsedSubOrderIds,
    language: formData.get("language") || "en",
    cost: formData.get("cost"),
    cost_currency: formData.get("cost_currency"),
    markup_percent: formData.get("markup_percent"),
    discount_amount: formData.get("discount_amount") || 0,
    shipment_fee: formData.get("shipment_fee") || 0,
    tax_percent: formData.get("tax_percent") || 0,
    total_currency: formData.get("total_currency"),
    items: parsedItems,
    submit_for_review: formData.get("submit_for_review") === "on" || formData.get("submit_for_review") === "true",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  // Compute totals from line items (don't trust the client value).
  // Discount applied to gross item price BEFORE shipping + VAT.
  const itemPrice = v.items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
  const discount = Math.min(v.discount_amount, itemPrice); // can't discount more than items
  const discountedItems = itemPrice - discount;
  const taxAmount = (discountedItems + v.shipment_fee) * (v.tax_percent / 100);
  const total = discountedItems + v.shipment_fee + taxAmount;
  const profitAmount = total - v.cost - v.shipment_fee - taxAmount;
  const profitPercent = v.cost > 0 ? (profitAmount / v.cost) * 100 : null;

  const sb = createServiceClient();

  // Generate invoice number atomically.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: numData, error: numErr } = await (sb.rpc as any)("next_invoice_sequence", {
    p_year: new Date().getUTCFullYear(),
  });
  if (numErr || !numData) {
    return { ok: false, error: numErr?.message ?? "Couldn't reserve invoice number." };
  }
  const invoiceNumber = numData as string;

  // Insert invoice header.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invRow, error: invErr } = await (sb.from("customer_invoices") as any)
    .insert({
      invoice_number: invoiceNumber,
      order_id: v.order_id,
      status: v.submit_for_review ? "pending_review" : "draft",
      cost: v.cost,
      cost_currency: v.cost_currency,
      markup_percent: v.markup_percent,
      item_price: itemPrice,
      discount_amount: discount,
      shipment_fee: v.shipment_fee,
      tax_percent: v.tax_percent,
      tax_amount: taxAmount,
      total,
      total_currency: v.total_currency,
      profit_amount: profitAmount,
      profit_percent: profitPercent,
      language: v.language,
      generated_by: user.id,
      generated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (invErr || !invRow) {
    return { ok: false, error: invErr?.message ?? "Failed to create invoice." };
  }
  const invoiceId = (invRow as { id: string }).id;

  // Insert line items.
  const itemRows = v.items.map((it, i) => ({
    customer_invoice_id: invoiceId,
    position: i,
    title: it.title,
    sku: it.sku || null,
    quantity: it.quantity,
    unit_price: it.unit_price,
    line_total: it.quantity * it.unit_price,
    sub_order_id: it.sub_order_id || null,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: itemsErr } = await (sb.from("customer_invoice_items") as any).insert(itemRows);
  if (itemsErr) return { ok: false, error: `Items: ${itemsErr.message}` };

  // Junction rows for the bundled sub-orders.
  const junctionRows = v.sub_order_ids.map((sid) => ({
    customer_invoice_id: invoiceId,
    sub_order_id: sid,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: junctionErr } = await (sb.from("customer_invoice_sub_orders") as any).insert(
    junctionRows,
  );
  if (junctionErr) return { ok: false, error: `Sub-orders: ${junctionErr.message}` };

  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}
