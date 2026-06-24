/**
 * Re-render the PDF for an EXISTING tax invoice (or all of them).
 *
 * The per-item 70-SAR breakdown (profit/shipping/VAT) is computed at PDF-render
 * time in buildTaxInvoicePdfData, so old invoices created before that calc just
 * need their PDF re-rendered — no row is changed or deleted. uploadTaxInvoicePdf
 * upserts, so this overwrites the previous render in place.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { renderTaxInvoicePdf } from "@/lib/pdf/tax-invoice-pdf";
import { buildTaxInvoicePdfData } from "@/lib/services/tax-invoice-pdf-data";
import { uploadTaxInvoicePdf } from "@/lib/storage/tax-invoices";

type RegenResult = { invoiceId: string; invoiceNumber: string; ok: boolean; error?: string };

export async function regenerateTaxInvoicePdf(invoiceId: string): Promise<RegenResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;

  const { data: inv, error } = await sb
    .from("tax_invoices")
    .select("id, invoice_number, order_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (error || !inv) {
    return { invoiceId, invoiceNumber: "", ok: false, error: error?.message ?? "invoice not found" };
  }

  const pdfData = await buildTaxInvoicePdfData(inv.order_id, inv.invoice_number);
  if (!pdfData) {
    return { invoiceId, invoiceNumber: inv.invoice_number, ok: false, error: "order data unavailable" };
  }
  const pdf = await renderTaxInvoicePdf(pdfData);
  const path = await uploadTaxInvoicePdf(inv.invoice_number, pdf);
  await sb
    .from("tax_invoices")
    .update({ pdf_storage_path: path, total_fee: pdfData.totals.grand_total })
    .eq("id", inv.id);

  return { invoiceId, invoiceNumber: inv.invoice_number, ok: true };
}

export async function regenerateAllTaxInvoicePdfs(): Promise<RegenResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;
  const { data: rows } = await sb.from("tax_invoices").select("id").order("created_at");
  const results: RegenResult[] = [];
  // ponytail: sequential — 13 invoices, each launches a headless-Chrome render;
  // parallel would spike memory on the serverless function. Batch if this grows.
  for (const r of rows ?? []) {
    try {
      results.push(await regenerateTaxInvoicePdf(r.id));
    } catch (e) {
      results.push({ invoiceId: r.id, invoiceNumber: "", ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}
