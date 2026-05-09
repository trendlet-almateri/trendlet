/**
 * GET /api/cron/shopify-poll
 *
 * Runs every 5 minutes via cron (Vercel cron OR GitHub Actions hitting
 * this URL with CRON_SECRET in Authorization header). Delegates to the
 * shared runShopifyPoll() helper — same logic admin "Run sync now"
 * button uses.
 */
import { NextResponse } from "next/server";
import { runShopifyPoll } from "@/lib/shopify/poll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  // CRON_SECRET check. If the env var is set, require Bearer auth.
  // If not set, allow open access (dev convenience — set CRON_SECRET in prod).
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await runShopifyPoll();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
