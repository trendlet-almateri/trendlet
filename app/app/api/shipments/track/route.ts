import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { trackDhlShipment, type TrackResult } from "@/lib/integrations/dhl";

export async function GET(req: Request) {
  await requireAdmin();
  const tn = new URL(req.url).searchParams.get("trackingNumber")?.trim();
  if (!tn) {
    return NextResponse.json({ found: false, error: "Missing trackingNumber" }, { status: 400 });
  }

  const result = await trackDhlShipment(tn);
  if (result.found) {
    // Refresh our stored copy so the history survives DHL's retention window.
    await saveSnapshot(tn, result);
    return NextResponse.json(result);
  }

  // DHL has no record — it only serves live tracking for a few months after
  // delivery. Fall back to the last result we stored ourselves. A number we
  // never tracked successfully has no snapshot, so an unknown number still
  // correctly reports not-found rather than inventing a result.
  const cached = await loadSnapshot(tn);
  if (cached) {
    return NextResponse.json({
      ...cached.snapshot,
      found: true,
      from_cache: true,
      cached_at: cached.syncedAt,
    });
  }

  return NextResponse.json(result);
}

async function saveSnapshot(trackingNumber: string, result: TrackResult): Promise<void> {
  try {
    // tracking_snapshot / tracking_synced_at are newer than the generated
    // Database types — cast until they are regenerated.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceClient() as any;
    await sb
      .from("shipments")
      .update({
        tracking_snapshot: result,
        tracking_synced_at: new Date().toISOString(),
      })
      .eq("tracking_number", trackingNumber);
  } catch (e) {
    // Never fail the lookup because caching failed.
    console.error("[track] snapshot save failed", trackingNumber, e);
  }
}

async function loadSnapshot(
  trackingNumber: string,
): Promise<{ snapshot: TrackResult; syncedAt: string | null } | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceClient() as any;
    const { data } = await sb
      .from("shipments")
      .select("tracking_snapshot, tracking_synced_at")
      .eq("tracking_number", trackingNumber)
      .maybeSingle();

    const row = data as { tracking_snapshot: TrackResult | null; tracking_synced_at: string | null } | null;
    if (!row?.tracking_snapshot?.events) return null;
    return { snapshot: row.tracking_snapshot, syncedAt: row.tracking_synced_at };
  } catch (e) {
    console.error("[track] snapshot load failed", trackingNumber, e);
    return null;
  }
}
