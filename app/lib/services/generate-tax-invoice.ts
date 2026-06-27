/**
 * Auto-generate a tax invoice for a newly ingested order.
 *
 * Called fire-and-forget from the Shopify orders/create webhook, and reusable
 * for backfill/regeneration. The fee breakdown (70-SAR profit + shipping + VAT
 * per item) is derived at render time from each product's custom.extra
 * metafield — it does NOT depend on brand/category pricing — so EVERY order
 * issues a real invoice with a PDF. No more "needs_pricing" dead-end.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { renderTaxInvoicePdf } from "@/lib/pdf/tax-invoice-pdf";
import { buildTaxInvoicePdfData } from "@/lib/services/tax-invoice-pdf-data";
import { uploadTaxInvoicePdf } from "@/lib/storage/tax-invoices";

type GenResult =
  | { action: "issued"; invoiceId: string; invoiceNumber: string }
  | { action: "skipped"; reason: string };

export async function generateTaxInvoiceForOrder(orderId: string): Promise<GenResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;

  // One tax invoice per order — a duplicate webhook must not create a second.
  const { data: existing } = await sb
    .from("tax_invoices")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existing) return { action: "skipped", reason: "already has a tax invoice" };

  // The order is inserted in the same webhook request; this Supabase instance
  // has read-after-write lag, so retry briefly until the order is visible.
  let order: { id: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await sb.from("orders").select("id").eq("id", orderId).maybeSingle();
    order = data ?? null;
    if (order) break;
    await new Promise((r) => setTimeout(r, 400)); // ~0.4s backoff, ~2s total
  }
  if (!order) return { action: "skipped", reason: "order not found (after retries)" };

  // Reserve the invoice number atomically (shared with the manual flow).
  const { data: numData, error: numErr } = await sb.rpc("next_tax_invoice_sequence", {
    p_year: new Date().getUTCFullYear(),
  });
  if (numErr || !numData) {
    return { action: "skipped", reason: numErr?.message ?? "no invoice number" };
  }
  const invoiceNumber = numData as string;

  // Issue the invoice. The fee snapshot columns (brand/category/pricing_rule)
  // belong to the retired brand-pricing model and are left null — the real
  // figures live in the PDF's per-item breakdown.
  const { data: inv, error: invErr } = await sb
    .from("tax_invoices")
    .insert({
      invoice_number: invoiceNumber,
      order_id: orderId,
      status: "issued",
      currency: "SAR",
      generated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (invErr || !inv) {
    return { action: "skipped", reason: invErr?.message ?? "invoice insert failed" };
  }

  try {
    const pdfData = await buildTaxInvoicePdfData(orderId, invoiceNumber);
    if (!pdfData) throw new Error("order data unavailable for PDF");
    // Snapshot the order total + needs-extra flag so list cards don't recompute.
    await sb.from("tax_invoices").update({
      total_fee: pdfData.totals.grand_total,
      needs_extra: pdfData.breakdown?.missing_extra ?? false,
    }).eq("id", inv.id);
    const pdf = await renderTaxInvoicePdf(pdfData);
    const path = await uploadTaxInvoicePdf(invoiceNumber, pdf);
    await sb.from("tax_invoices").update({ pdf_storage_path: path }).eq("id", inv.id);
  } catch (e) {
    // Row stands; PDF can be regenerated from the tax-invoices page.
    console.error("[generateTaxInvoiceForOrder] pdf", e);
  }

  return { action: "issued", invoiceId: inv.id, invoiceNumber };
}
