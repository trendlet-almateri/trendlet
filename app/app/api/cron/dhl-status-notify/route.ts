/**
 * GET /api/cron/dhl-status-notify
 *
 * Every 6 hours: check DHL for shipments still in flight and send the customer
 * WhatsApp updates their new status warrants. Nothing is sent for a status
 * that has not changed — see pollDhlAndNotify.
 *
 * Cadence is bounded by the DHL request budget (DHL_DAILY_LIMIT = 250/day,
 * shared with staff lookups on the shipments page). Every 6 hours costs 4
 * calls per in-flight shipment per day, so ~50 concurrent shipments fit
 * comfortably. Polling every 30 minutes would cost 48/day each and exhaust
 * the budget at 5 shipments.
 *
 * Auth: Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
 */
import { NextResponse } from "next/server";
import { pollDhlAndNotify } from "@/lib/shipping/send-dhl-updates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const summary = await pollDhlAndNotify();
  console.log(`[dhl-status-notify] ${JSON.stringify(summary)} in ${Date.now() - started}ms`);

  return NextResponse.json({ ok: true, ...summary });
}
