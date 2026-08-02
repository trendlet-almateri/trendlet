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

      await sendInvoicePdfAndRecord(sb, {
        invoiceId: inv.id,
        invoiceNumber: num,
        storagePath: path,
        subOrderNumber: s.sub_order_number,
        phone: cust?.phone ?? addr?.phone ?? null,
        attemptsSoFar: 0,
      });

      result.created++;
    } catch (e) {
      // The invoice row stands but has no PDF, so it was never sent either.
      // resendPendingInvoiceWhatsApp cannot help (it requires a PDF), so this
      // is a real error, not a success — counting it as "created" is what made
      // earlier PDF-less invoices look fine and never get regenerated.
      console.error("[generateCustomerInvoiceForOrder] pdf render failed", num, e);
      result.errors++;
    }
  }

  return result;
}

/** Cap on WhatsApp send attempts per invoice — stops a permanently failing
 *  send (bad number, revoked template) from retrying every 5 minutes forever. */
const MAX_WHATSAPP_ATTEMPTS = 5;

/**
 * Send one invoice's PDF over WhatsApp and record the outcome on the invoice
 * row: `whatsapp_attempts` always increments, `whatsapp_sent_at` is stamped
 * only on a confirmed send. That stamp is what stops any further retry, so it
 * is written immediately after the send returns.
 *
 * Shared by the create path and the retry sweep so both record identically.
 */
async function sendInvoicePdfAndRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  input: {
    invoiceId: string;
    invoiceNumber: string;
    storagePath: string;
    subOrderNumber: string;
    phone: string | null;
    attemptsSoFar: number;
  },
): Promise<"sent" | "skipped" | "failed"> {
  await sb
    .from("customer_invoices")
    .update({ whatsapp_attempts: input.attemptsSoFar + 1 })
    .eq("id", input.invoiceId);

  try {
    const signedUrl = await getCustomerInvoiceSignedUrl(input.storagePath, 7 * 24 * 3600);
    if (!signedUrl) {
      console.error("[invoice-whatsapp] could not sign pdf url", input.invoiceNumber);
      return "failed";
    }

    const sent = await sendInvoicePdfWhatsApp({
      phone: input.phone,
      subOrderNumber: input.subOrderNumber,
      signedPdfUrl: signedUrl,
    });
    console.log("[invoice-whatsapp]", input.invoiceNumber, sent.mode, sent.error ?? "");

    if (sent.mode === "live" && sent.message_sid) {
      await sb
        .from("customer_invoices")
        .update({ whatsapp_sent_at: new Date().toISOString() })
        .eq("id", input.invoiceId);
      return "sent";
    }
    // "skipped" = kill-switch off or unusable phone. Neither is retryable, but
    // the attempt counter still bounds it.
    return sent.mode === "skipped" || sent.mode === "missing-phone" ? "skipped" : "failed";
  } catch (e) {
    console.error("[invoice-whatsapp] send failed", input.invoiceNumber, e);
    return "failed";
  }
}

/**
 * Retry sweep: re-send invoices that have a PDF but were never confirmed sent.
 * Called from the Shopify poll, so a Twilio outage or a crash between render
 * and send heals itself within ~5 minutes instead of the customer silently
 * never receiving their invoice.
 *
 * Bounded three ways: MAX_WHATSAPP_ATTEMPTS, a 7-day window, and `limit`.
 * `whatsapp_sent_at` makes a double-send impossible once one succeeds.
 */
export async function resendPendingInvoiceWhatsApp(limit = 10): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: pending } = await sb
    .from("customer_invoices")
    .select(`
      id, invoice_number, pdf_storage_path, whatsapp_attempts,
      order:orders ( customer:customers ( phone ) ),
      links:customer_invoice_sub_orders ( sub_order:sub_orders ( sub_order_number ) )
    `)
    .not("pdf_storage_path", "is", null)
    .is("whatsapp_sent_at", null)
    .lt("whatsapp_attempts", MAX_WHATSAPP_ATTEMPTS)
    .gte("created_at", since)
    .limit(limit);

  const out = { sent: 0, failed: 0, skipped: 0 };
  for (const inv of pending ?? []) {
    const subNumber = inv.links?.[0]?.sub_order?.sub_order_number;
    if (!subNumber) { out.skipped++; continue; }

    const res = await sendInvoicePdfAndRecord(sb, {
      invoiceId: inv.id,
      invoiceNumber: inv.invoice_number,
      storagePath: inv.pdf_storage_path,
      subOrderNumber: subNumber,
      phone: inv.order?.customer?.phone ?? null,
      attemptsSoFar: inv.whatsapp_attempts ?? 0,
    });
    out[res === "sent" ? "sent" : res === "skipped" ? "skipped" : "failed"]++;
  }
  return out;
}
