import { createServiceClient } from "@/lib/supabase/server";

// Reuses the existing private "shipping-labels" bucket (migration
// 20260427000010_storage_buckets.sql) — admin RLS already in place.
const BUCKET = "shipping-labels";

/**
 * Upload a DHL shipment document (label or commercial invoice) PDF.
 * Path: {yyyy}/{trackingNumber}-{typeCode}.pdf
 * Returns the storage path (store on shipments.label_storage_path for the label).
 */
export async function uploadShipmentDoc(
  trackingNumber: string,
  typeCode: string,
  pdf: Buffer,
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const path = `${year}/${trackingNumber}-${typeCode}.pdf`;

  const sb = createServiceClient();
  const { error } = await sb.storage.from(BUCKET).upload(path, pdf, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) throw new Error(`Label upload failed: ${error.message}`);
  return path;
}

/** Short-lived signed URL for the admin UI (bucket is private). */
export async function getShipmentDocSignedUrl(
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
