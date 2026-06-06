import { createServiceClient } from "@/lib/supabase/server";

const BUCKET = "tax-invoices";

/**
 * Upload a tax-invoice PDF to Supabase Storage.
 * Returns the storage path stored on `tax_invoices.pdf_storage_path`.
 *
 * Path convention: tax-invoices/{yyyy}/{invoice_number}.pdf
 */
export async function uploadTaxInvoicePdf(
  invoiceNumber: string,
  pdf: Buffer,
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const path = `${year}/${invoiceNumber}.pdf`;

  const sb = createServiceClient();
  const { error } = await sb.storage.from(BUCKET).upload(path, pdf, {
    contentType: "application/pdf",
    upsert: true, // Regenerate overwrites the previous render.
  });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

/**
 * Short-lived signed URL for previewing/downloading the PDF from the admin UI.
 * The bucket is private.
 */
export async function getTaxInvoiceSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const sb = createServiceClient();
  const { data, error } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
