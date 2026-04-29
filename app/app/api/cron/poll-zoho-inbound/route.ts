import { NextResponse } from "next/server";
import { processZohoInbound } from "@/lib/services/process-zoho-inbound";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Phase 5: daily cron pulls fresh PDF receipts from the Zoho mailbox
 * and inserts them as supplier_invoices rows so the admin/sourcing
 * workflow picks them up automatically.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Reject
 * everything else.
 *
 * Schedule: configured in vercel.json. Hobby plan = daily-only.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 26h lookback gives a 2h overlap with yesterday's run for safety.
  const summary = await processZohoInbound({ lookbackHours: 26 });
  return NextResponse.json(summary);
}
