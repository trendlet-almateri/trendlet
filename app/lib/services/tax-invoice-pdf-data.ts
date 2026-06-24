/**
 * Build TaxInvoicePdfData from an order's Shopify raw_payload + customer row.
 *
 * Shared by both PDF call sites (the manual /tax-invoices action and the
 * webhook auto-generation) so the customer-facing invoice always renders from
 * the same fields. The tax_invoices row itself only stores the fee snapshot;
 * the customer-facing body (line items, customer, payment) is read from the
 * order at render time.
 */

import { createServiceClient } from "@/lib/supabase/server";
import type { TaxInvoicePdfData, TaxInvoiceLineItem } from "@/lib/pdf/tax-invoice-pdf";
import { getProductExtra } from "@/lib/integrations/shopify-metafields";

/* ── tax breakdown constants ─────────────────────────────────────────── */
const FIXED_PROFIT_PER_ITEM = 70; // client's fixed profit per item (SAR)
const VAT_RATE = 0.15; // KSA VAT, applied to the profit only

/* ── Shopify raw_payload (only the fields we read) ───────────────────── */

type ShopMoney = { city?: string | null; phone?: string | null };

type ShopifyLineItem = {
  title?: string | null;
  variant_title?: string | null;
  quantity?: number | null;
  price?: string | null;
  product_id?: number | string | null;
};

type ShopifyRawPayload = {
  line_items?: ShopifyLineItem[];
  subtotal_price?: string | null;
  total_discounts?: string | null;
  total_price?: string | null;
  currency?: string | null;
  payment_gateway_names?: string[] | null;
  financial_status?: string | null;
  processed_at?: string | null;
  created_at?: string | null;
  shipping_address?: ShopMoney | null;
  billing_address?: ShopMoney | null;
};

/* ── helpers ─────────────────────────────────────────────────────────── */

function num(s: string | null | undefined): number {
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Map a Shopify payment gateway name to a clean display label. */
function gatewayLabel(gateway: string | null | undefined): string | null {
  if (!gateway) return null;
  const g = gateway.toLowerCase();
  if (g.includes("tabby")) return "Tabby";
  if (g.includes("tamara")) return "Tamara";
  if (g.includes("mada")) return "Mada";
  if (g.includes("apple")) return "Apple Pay";
  if (g.includes("clickpay") || g.includes("visa") || g.includes("master") || g.includes("credit"))
    return "بطاقة ائتمان";
  if (g.includes("cash") || g.includes("cod")) return "الدفع عند الاستلام";
  return gateway;
}

/* ── builder ─────────────────────────────────────────────────────────── */

/**
 * Fetch the order + customer and assemble the PDF data. Returns null if the
 * order can't be read. The caller supplies the reserved invoice number.
 */
export async function buildTaxInvoicePdfData(
  orderId: string,
  invoiceNumber: string,
): Promise<TaxInvoicePdfData | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;

  const { data: order, error } = await sb
    .from("orders")
    .select(`
      id, shopify_order_number, raw_payload, shopify_created_at,
      customer:customers ( first_name, last_name, phone, default_address )
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    console.error("[buildTaxInvoicePdfData] order not found", error);
    return null;
  }

  const raw = (order.raw_payload ?? {}) as ShopifyRawPayload;
  const customer = order.customer as {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    default_address: { city?: string | null; phone?: string | null } | null;
  } | null;

  const currency = raw.currency ?? "SAR";

  const rawItems = raw.line_items ?? [];

  // Line items: price × quantity per row (order-level discount shown separately).
  const lineItems: TaxInvoiceLineItem[] = rawItems.map((li) => {
    const unit = num(li.price);
    const qty = li.quantity ?? 1;
    return {
      title: li.title ?? "",
      variant_title: li.variant_title || null,
      quantity: qty,
      unit_price: unit,
      line_total: unit * qty,
    };
  });

  // ── Tax breakdown (tax-invoice only) ───────────────────────────────────
  // Per item, from the product's custom.extra metafield:
  //   profit   = 70 (fixed)            shipping = max(0, extra - 70)
  //   vat      = profit * 0.15
  // Summed across items × quantity. Missing/empty extra ⇒ extra = 0 ⇒
  // shipping = 0, still 70 profit + VAT. This BREAKS DOWN the existing total —
  // it does not change grand_total.
  let breakdownShipping = 0;
  let breakdownProfit = 0;
  let breakdownVat = 0;
  let missingExtra = false; // any item whose product has no custom.extra set
  await Promise.all(
    rawItems.map(async (li) => {
      const qty = li.quantity ?? 1;
      const raw = li.product_id != null ? await getProductExtra(li.product_id) : null;
      if (raw == null) missingExtra = true;
      const extra = raw ?? 0;
      const shippingPerItem = Math.max(0, extra - FIXED_PROFIT_PER_ITEM);
      breakdownShipping += shippingPerItem * qty;
      breakdownProfit += FIXED_PROFIT_PER_ITEM * qty;
      breakdownVat += FIXED_PROFIT_PER_ITEM * VAT_RATE * qty;
    }),
  );
  const breakdown = {
    shipping: +breakdownShipping.toFixed(2),
    profit: +breakdownProfit.toFixed(2),
    vat: +breakdownVat.toFixed(2),
    missing_extra: missingExtra,
  };

  // Totals. Prefer Shopify's own figures; fall back to summing line items.
  const summed = lineItems.reduce((s, i) => s + i.line_total, 0);
  const subtotal = num(raw.subtotal_price) || summed;
  const discount = num(raw.total_discounts);
  const grandTotal = num(raw.total_price) || subtotal - discount;

  // Customer name / phone / city. Phone+city fall back from order shipping
  // address → customer row → customer default address.
  const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ");
  const phone =
    raw.shipping_address?.phone ??
    customer?.phone ??
    customer?.default_address?.phone ??
    null;
  const city =
    raw.shipping_address?.city ??
    raw.billing_address?.city ??
    customer?.default_address?.city ??
    null;

  const paymentMethod = gatewayLabel(raw.payment_gateway_names?.[0] ?? null);
  const paid = raw.financial_status === "paid";

  // Issue date = the order's actual date (Shopify created_at), not render time.
  // Due date = 7 days after issue.
  const orderDate =
    raw.created_at ??
    (order.shopify_created_at as string | null) ??
    new Date().toISOString();
  const issueDate = orderDate;
  const dueDate = new Date(new Date(orderDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    invoice_number: invoiceNumber,
    issue_date: issueDate,
    due_date: dueDate,
    order: { shopify_order_number: order.shopify_order_number ?? null },
    customer: { name, phone, city, payment_method: paymentMethod },
    line_items: lineItems,
    totals: { subtotal, discount, grand_total: grandTotal, currency },
    payment: { paid, method: paymentMethod, paid_at: raw.processed_at ?? null },
    breakdown,
  };
}
