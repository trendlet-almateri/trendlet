"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { trackDhlShipment, type TrackResult } from "@/lib/integrations/dhl";
import { getShipmentDocSignedUrl } from "@/lib/storage/shipment-labels";

export type AddTrackingResult = { ok: boolean; error: string | null };

/** Count of DHL API requests made today (UTC), from api_logs. */
export async function dhlRequestsToday(): Promise<number> {
  const sb = createServiceClient();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await sb
    .from("api_logs")
    .select("*", { count: "exact", head: true })
    .eq("service", "dhl")
    .gte("created_at", since.toISOString());
  return count ?? 0;
}

/** Upsert a shipments row from an already-fetched DHL result (no extra DHL call). */
async function persist(r: TrackResult): Promise<AddTrackingResult> {
  const row = {
    tracking_number: r.tracking_number,
    shipment_type: r.service ?? "express",
    origin: r.origin,
    destination: r.destination,
    status: r.status_code ?? "unknown",
    shipped_at: r.events.length ? r.events[r.events.length - 1].timestamp || null : null,
    delivered_at: r.status_code === "delivered" ? r.last_update : null,
  };

  // No unique constraint on tracking_number — find-then-update/insert
  // rather than upsert (avoids a schema migration).
  const sb = createServiceClient();
  const { data: existing } = await sb
    .from("shipments")
    .select("id")
    .eq("tracking_number", r.tracking_number)
    .maybeSingle();

  const { error } = existing
    ? await sb.from("shipments").update(row).eq("id", existing.id)
    : await sb.from("shipments").insert(row);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/shipments");
  return { ok: true, error: null };
}

/**
 * Save from a result the client already fetched via /api/shipments/track.
 * Used by auto-save so a new lookup costs exactly ONE DHL request.
 */
export async function saveTrackingResultAction(r: TrackResult): Promise<AddTrackingResult> {
  await requireAdmin();
  if (!r.found) return { ok: false, error: r.error ?? "Not found" };
  return persist(r);
}

/**
 * Manual tracking-number entry. Looks the number up live via the DHL
 * Pull API and upserts a row into `shipments`. Intentionally NOT wired
 * to order/sub-order state — standalone tracking view for now.
 */
export async function addTrackingNumberAction(trackingNumber: string): Promise<AddTrackingResult> {
  await requireAdmin();

  const tn = trackingNumber.trim();
  if (!tn) return { ok: false, error: "Enter a tracking number" };

  const r = await trackDhlShipment(tn);
  if (!r.found) return { ok: false, error: r.error ?? "Not found" };
  return persist(r);
}

export async function refreshTrackingAction(trackingNumber: string): Promise<AddTrackingResult> {
  return addTrackingNumberAction(trackingNumber);
}

/** Short-lived signed URL for a stored shipment document (label or invoice). */
export async function getShipmentDocUrlAction(storagePath: string): Promise<string | null> {
  await requireAdmin();
  return getShipmentDocSignedUrl(storagePath);
}
