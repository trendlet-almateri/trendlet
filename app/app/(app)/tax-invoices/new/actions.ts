"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import {
  findPricingRule,
  listRulesForBrand,
  type PricingRule,
} from "@/lib/queries/tax-pricing";
import { renderTaxInvoicePdf } from "@/lib/pdf/tax-invoice-pdf";
import { uploadTaxInvoicePdf } from "@/lib/storage/tax-invoices";

/* ── order typeahead ─────────────────────────────────────────────────── */

export type OrderHit = {
  order_id: string;
  shopify_order_number: string;
  customer_name: string;
  /** First sub-order line, used to seed brand + category for the pricing match. */
  brand_name: string | null;
  product_type: string | null;
  /** Auto-matched pricing rule for that line, or null if nothing matched. */
  matched: PricingRule | null;
};

/**
 * Typeahead over orders by Shopify order number. Returns enough to seed the
 * tax-invoice form: the order's first sub-order brand + category, plus the
 * auto-matched pricing rule (often null — see findPricingRule).
 */
export async function searchOrdersForTax(query: string): Promise<OrderHit[]> {
  await requireRole(["admin"]);
  const q = query.trim();
  if (q.length < 1) return [];

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("orders")
    .select(`
      id, shopify_order_number,
      customer:customers ( first_name, last_name ),
      sub_orders ( product_type, brand:brands ( name ) )
    `)
    .ilike("shopify_order_number", `%${q}%`)
    .order("shopify_created_at", { ascending: false, nullsFirst: false })
    .limit(10);

  if (error) {
    console.error("[searchOrdersForTax]", error);
    return [];
  }

  type Row = {
    id: string;
    shopify_order_number: string;
    customer: { first_name: string | null; last_name: string | null } | null;
    sub_orders: { product_type: string | null; brand: { name: string } | null }[] | null;
  };

  const rows = (data ?? []) as unknown as Row[];
  return Promise.all(
    rows.map(async (r) => {
      const first = (r.sub_orders ?? [])[0] ?? null;
      const brandName = first?.brand?.name ?? null;
      const productType = first?.product_type ?? null;
      const matched = await findPricingRule(brandName, productType);
      const name = r.customer
        ? [r.customer.first_name, r.customer.last_name].filter(Boolean).join(" ")
        : "";
      return {
        order_id: r.id,
        shopify_order_number: r.shopify_order_number,
        customer_name: name || "—",
        brand_name: brandName,
        product_type: productType,
        matched,
      };
    }),
  );
}

/** Pricing rules for one brand — drives the manual category select. */
export async function getRulesForBrand(brandName: string): Promise<PricingRule[]> {
  await requireRole(["admin"]);
  return listRulesForBrand(brandName);
}

/* ── create ──────────────────────────────────────────────────────────── */

const createSchema = z.object({
  order_id: z.string().uuid("Pick an order."),
  brand_name: z.string().trim().nullable().optional(),
  category_ar: z.string().trim().nullable().optional(),
  // When set, fees are re-read from this rule server-side (client values ignored).
  pricing_rule_id: z.string().uuid().nullable().optional(),
  // Manual-entry fees, used ONLY when pricing_rule_id is null.
  service_fee_net: z.coerce.number().nonnegative().default(0),
  service_fee_vat: z.coerce.number().nonnegative().default(0),
  service_fee_with_vat: z.coerce.number().nonnegative().default(0),
  shipping_customs_fee: z.coerce.number().nonnegative().default(0),
  issue: z.coerce.boolean().default(false),
});

export type CreateTaxInvoiceState = { ok: boolean; error: string | null };

export async function createTaxInvoiceAction(
  _prev: CreateTaxInvoiceState,
  formData: FormData,
): Promise<CreateTaxInvoiceState> {
  const user = await requireRole(["admin"]);

  const parsed = createSchema.safeParse({
    order_id: formData.get("order_id"),
    brand_name: formData.get("brand_name") || null,
    category_ar: formData.get("category_ar") || null,
    pricing_rule_id: formData.get("pricing_rule_id") || null,
    service_fee_net: formData.get("service_fee_net") || 0,
    service_fee_vat: formData.get("service_fee_vat") || 0,
    service_fee_with_vat: formData.get("service_fee_with_vat") || 0,
    shipping_customs_fee: formData.get("shipping_customs_fee") || 0,
    issue: formData.get("issue") === "true",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const sb = createServiceClient();

  // Resolve fees authoritatively. If a pricing rule was chosen, re-read it from
  // the DB — never trust client-submitted fee amounts for a tax document.
  let fees = {
    service_fee_net: v.service_fee_net,
    service_fee_vat: v.service_fee_vat,
    service_fee_with_vat: v.service_fee_with_vat,
    shipping_customs_fee: v.shipping_customs_fee,
  };
  let brandName = v.brand_name ?? null;
  let categoryAr = v.category_ar ?? null;

  if (v.pricing_rule_id) {
    // pricing_rules is absent from generated Database types — cast for this read.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rule, error: ruleErr } = await (sb as any)
      .from("pricing_rules")
      .select(
        "brand_name, category_ar, service_fee_net, service_fee_vat, service_fee_with_vat, shipping_customs_fee",
      )
      .eq("id", v.pricing_rule_id)
      .maybeSingle();
    if (ruleErr || !rule) {
      return { ok: false, error: "Selected pricing rule no longer exists." };
    }
    const rr = rule as Record<string, unknown>;
    fees = {
      service_fee_net: Number(rr.service_fee_net ?? 0),
      service_fee_vat: Number(rr.service_fee_vat ?? 0),
      service_fee_with_vat: Number(rr.service_fee_with_vat ?? 0),
      shipping_customs_fee: Number(rr.shipping_customs_fee ?? 0),
    };
    brandName = (rr.brand_name as string) ?? brandName;
    categoryAr = (rr.category_ar as string) ?? categoryAr;
  }

  const totalFee = fees.service_fee_with_vat + fees.shipping_customs_fee;

  // Reserve the invoice number atomically.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: numData, error: numErr } = await (sb.rpc as any)("next_tax_invoice_sequence", {
    p_year: new Date().getUTCFullYear(),
  });
  if (numErr || !numData) {
    return { ok: false, error: numErr?.message ?? "Couldn't reserve invoice number." };
  }
  const reservedNumber = numData as string;

  // An order may already have an auto-generated invoice (e.g. a 'needs_pricing'
  // draft). One invoice per order is enforced by a unique index, so we resolve
  // that row in place rather than inserting a duplicate. Reuse its existing
  // number when present so we don't burn a sequence value.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prior } = await (sb as any)
    .from("tax_invoices")
    .select("id, invoice_number")
    .eq("order_id", v.order_id)
    .maybeSingle();

  const invoiceNumber = (prior as { invoice_number?: string } | null)?.invoice_number ?? reservedNumber;

  const fields = {
    invoice_number: invoiceNumber,
    order_id: v.order_id,
    status: v.issue ? "issued" : "draft",
    brand_name: brandName,
    category_ar: categoryAr,
    service_fee_net: fees.service_fee_net,
    service_fee_vat: fees.service_fee_vat,
    service_fee_with_vat: fees.service_fee_with_vat,
    shipping_customs_fee: fees.shipping_customs_fee,
    total_fee: totalFee,
    currency: "SAR",
    pricing_rule_id: v.pricing_rule_id ?? null,
    generated_by: user.id,
    generated_at: new Date().toISOString(),
  };

  let invoiceId: string;
  if (prior) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: upd, error: updErr } = await (sb as any)
      .from("tax_invoices")
      .update(fields)
      .eq("id", (prior as { id: string }).id)
      .select("id")
      .single();
    if (updErr || !upd) {
      return { ok: false, error: updErr?.message ?? "Failed to update tax invoice." };
    }
    invoiceId = (upd as { id: string }).id;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invRow, error: invErr } = await (sb as any)
      .from("tax_invoices")
      .insert(fields)
      .select("id")
      .single();
    if (invErr || !invRow) {
      return { ok: false, error: invErr?.message ?? "Failed to create tax invoice." };
    }
    invoiceId = (invRow as { id: string }).id;
  }

  // Render + store the PDF (always — drafts get a PDF too so admin can preview).
  try {
    const { data: ord } = await sb
      .from("orders")
      .select("shopify_order_number")
      .eq("id", v.order_id)
      .maybeSingle();

    const pdf = await renderTaxInvoicePdf({
      invoice_number: invoiceNumber,
      generated_at: new Date().toISOString(),
      order: {
        shopify_order_number:
          (ord as { shopify_order_number?: string } | null)?.shopify_order_number ?? null,
      },
      brand_name: brandName,
      category_ar: categoryAr,
      fees: { ...fees, total_fee: totalFee, currency: "SAR" },
    });
    const path = await uploadTaxInvoicePdf(invoiceNumber, pdf);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any)
      .from("tax_invoices")
      .update({ pdf_storage_path: path })
      .eq("id", invoiceId);
  } catch (e) {
    // The invoice row exists; surface the PDF failure but don't lose the row.
    console.error("[createTaxInvoiceAction] pdf", e);
    return {
      ok: false,
      error: `Invoice ${invoiceNumber} saved, but PDF generation failed: ${
        e instanceof Error ? e.message : "unknown error"
      }`,
    };
  }

  revalidatePath("/tax-invoices");
  redirect(`/tax-invoices/${invoiceId}`);
}
