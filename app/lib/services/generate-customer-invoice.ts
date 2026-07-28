/**
 * Auto-generate customer invoices for a newly ingested order — ONE per
 * sub-order, born 'approved' with a rendered PDF (no manual review).
 *
 * This is the automatic path. Manually-created invoices (the /invoices/new
 * form) keep the draft → pending_review → approved flow untouched; only
 * auto-created invoices skip approval.
 *
 * Pricing is "price-only": each invoice total = the sub-order's Shopify price
 * minus its allocated order discount, rounded to a whole number. cost/markup/
 * VAT are 0 (no supplier cost in order data) — the customer-facing PDF shows
 * only items + total, so this is a receipt, not a margin doc.
 *
 * Idempotent: skips sub-orders that already have an invoice, so a Shopify
 * webhook retry can't create duplicates.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { renderTaxInvoicePdf, type TaxInvoicePdfData } from "@/lib/pdf/tax-invoice-pdf";
import {
  uploadCustomerInvoicePdf,
  getCustomerInvoiceSignedUrl,
} from "@/lib/storage/customer-invoices";
import { gatewayLabel } from "@/lib/services/tax-invoice-pdf-data";
import { sendInvoicePdfWhatsApp } from "@/lib/integrations/twilio";

const AUTO_GENERATED_BY = "99126bae-c846-400e-9d36-7a0d34b3a1f6"; // ai@trendlet.com (system)

type GenResult = { created: number; skipped: number; errors: number };

/** Sum of a Shopify line item's discount_allocations (order-level discount
 *  spread across items), in shop currency. */
function lineItemDiscount(
  rawPayload: { line_items?: { id?: number | string; discount_allocations?: { amount?: string | number }[] }[] } | null,
  lineItemId: string | null,
): number {
  if (!rawPayload?.line_items || !lineItemId) return 0;
  const li = rawPayload.line_items.find((x) => String(x.id) === String(lineItemId));
  return (li?.discount_allocations ?? []).reduce((s, a) => s + Number(a.amount ?? 0), 0);
}

export async function generateCustomerInvoiceForOrder(orderId: string): Promise<GenResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;

  // Read-after-write lag: the order is inserted in the same webhook request.
  let orderExists = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await sb.from("orders").select("id").eq("id", orderId).maybeSingle();
    if (data) { orderExists = true; break; }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!orderExists) return { created: 0, skipped: 0, errors: 1 };

  // Pull this order's sub-orders + the raw payload (for discount allocations)
  // + customer/address/gateway (for the PDF).
  const { data: subs } = await sb
    .from("sub_orders")
    .select(`
      id, sub_order_number, product_title, sku, quantity, unit_price, currency,
      shopify_line_item_id, order_id,
      order:orders (
        shopify_order_number, raw_payload,
        customer:customers ( first_name, last_name, phone, default_address )
      )
    `)
    .eq("order_id", orderId);
  if (!subs || subs.length === 0) return { created: 0, skipped: 0, errors: 0 };

  // Which sub-orders already have an invoice (idempotency).
  const subIds = subs.map((s: { id: string }) => s.id);
  const { data: existing } = await sb
    .from("customer_invoice_sub_orders")
    .select("sub_order_id")
    .in("sub_order_id", subIds);
  const already = new Set((existing ?? []).map((r: { sub_order_id: string }) => r.sub_order_id));

  const year = new Date().getUTCFullYear();
  const result: GenResult = { created: 0, skipped: 0, errors: 0 };

  for (const s of subs) {
    if (already.has(s.id)) { result.skipped++; continue; }

    const qty = s.quantity ?? 1;
    const grossUnit = Number(s.unit_price ?? 0);
    const currency = s.currency || "SAR";
    const raw = s.order?.raw_payload ?? null;
    const discountAlloc = lineItemDiscount(raw, s.shopify_line_item_id);
    const lineTotal = Math.round(grossUnit * qty - discountAlloc); // discount baked in, whole number
    const unit = +(lineTotal / qty).toFixed(2);
    const total = lineTotal;

    // Reserve invoice number (shared sequence with the manual flow).
    const { data: num, error: numErr } = await sb.rpc("next_invoice_sequence", { p_year: year });
    if (numErr || !num) { result.errors++; continue; }

    // Insert header — status 'approved' (auto-created skips review).
    const { data: inv, error: invErr } = await sb
      .from("customer_invoices")
      .insert({
        invoice_number: num, order_id: s.order_id, status: "approved",
        cost: 0, cost_currency: currency, markup_percent: 0,
        item_price: total, discount_amount: 0, shipment_fee: 0,
        tax_percent: 0, tax_amount: 0, total, total_currency: currency,
        profit_amount: total, profit_percent: null, language: "ar",
        generated_by: AUTO_GENERATED_BY, generated_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (invErr || !inv) { result.errors++; continue; }

    // Line item + junction.
    const { error: itErr } = await sb.from("customer_invoice_items").insert({
      customer_invoice_id: inv.id, position: 0,
      title: s.product_title ?? "Item", sku: s.sku || null,
      quantity: qty, unit_price: unit, line_total: total, sub_order_id: s.id,
    });
    if (itErr) { result.errors++; continue; }
    await sb.from("customer_invoice_sub_orders").insert({
      customer_invoice_id: inv.id, sub_order_id: s.id,
    });

    // Render + store the PDF now (born final). If it fails, the row stands and
    // the PDF can be regenerated from the invoice page.
    try {
      const cust = s.order?.customer;
      const addr = cust?.default_address ?? null;
      const name = cust ? [cust.first_name, cust.last_name].filter(Boolean).join(" ").trim() || "Customer" : "Customer";
      const paymentMethod = gatewayLabel(raw?.payment_gateway_names?.[0] ?? null);
      const issueDate = new Date().toISOString();
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const data: TaxInvoicePdfData = {
        invoice_number: num,
        issue_date: issueDate,
        due_date: dueDate,
        order: {
          shopify_order_number: s.order?.shopify_order_number ?? null,
          sub_order_number: s.sub_order_number,
        },
        customer: { name, phone: cust?.phone ?? addr?.phone ?? null, city: addr?.city ?? null, payment_method: paymentMethod },
        line_items: [{
          title: s.product_title ?? "Item",
          variant_title: s.sku ? `SKU ${s.sku}` : null,
          quantity: qty, unit_price: unit, line_total: total,
        }],
        totals: { subtotal: total, discount: 0, grand_total: total, currency },
        payment: { paid: false, method: paymentMethod, paid_at: null },
      };
      const pdf = await renderTaxInvoicePdf(data);
      const path = await uploadCustomerInvoicePdf(num, pdf);
      await sb.from("customer_invoices").update({ pdf_storage_path: path }).eq("id", inv.id);

      // Send the PDF to the customer on WhatsApp (approved document template).
      // No-op unless INVOICE_WHATSAPP_ENABLED=true + template SID configured.
      // 7-day signed URL: Twilio fetches once at send time; WhatsApp then
      // hosts the media itself, so a later-expiring link is fine.
      try {
        const signedUrl = await getCustomerInvoiceSignedUrl(path, 7 * 24 * 3600);
        if (signedUrl) {
          const sent = await sendInvoicePdfWhatsApp({
            phone: cust?.phone ?? addr?.phone ?? null,
            subOrderNumber: s.sub_order_number,
            signedPdfUrl: signedUrl,
          });
          console.log("[generateCustomerInvoiceForOrder] whatsapp", num, sent.mode, sent.error ?? "");
        }
      } catch (e) {
        console.error("[generateCustomerInvoiceForOrder] whatsapp send failed", num, e);
      }
    } catch (e) {
      console.error("[generateCustomerInvoiceForOrder] pdf render failed", num, e);
    }

    result.created++;
  }

  return result;
}
