import { createServiceClient } from "@/lib/supabase/server";

const BUCKET = "customer-invoices";

/**
 * Upload a customer invoice PDF to Supabase Storage.
 * Returns the storage path stored on `customer_invoices.pdf_storage_path`.
 *
 * Path convention: customer-invoices/{yyyy}/{invoice_number}.pdf
 * — established in migration 10's bucket policy comment.
 */
export async function uploadCustomerInvoicePdf(
  invoiceNumber: string,
  pdf: Buffer,
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const path = `${year}/${invoiceNumber}.pdf`;

  const sb = createServiceClient();
  const { error } = await sb.storage.from(BUCKET).upload(path, pdf, {
    contentType: "application/pdf",
    upsert: true, // Re-renders (e.g. regenerate after metadata edit) overwrite.
  });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

/**
 * Return a short-lived signed URL for previewing/downloading the PDF
 * from the admin UI. The bucket is private — admins can only see their
 * invoice PDFs through one of these.
 */
export async function getCustomerInvoiceSignedUrl(
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
