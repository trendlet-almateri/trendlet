"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { trackDhlShipment } from "@/lib/integrations/dhl";

export type AddTrackingResult = { ok: boolean; error: string | null };

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

export async function refreshTrackingAction(trackingNumber: string): Promise<AddTrackingResult> {
  return addTrackingNumberAction(trackingNumber);
}
