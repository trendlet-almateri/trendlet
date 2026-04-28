import { NextResponse } from "next/server";
import { syncHubstaff } from "@/lib/integrations/hubstaff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Hourly cron pulls the last 24h of time entries from Hubstaff (or the
 * mock-fallback no-op when HUBSTAFF_TOKEN is missing).
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Reject
 * everything else so this can't be invoked from the public internet.
 *
 * Set up in vercel.json (production) or trigger via cron-job.org for staging:
 *   { "crons": [{ "path": "/api/cron/pull-hubstaff", "schedule": "0 * * * *" }] }
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await syncHubstaff({ since });

  return NextResponse.json(result);
}
