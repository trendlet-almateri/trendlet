/**
 * POST /api/admin/shopify-poll-now
 *
 * Admin manual trigger of the same poll the cron runs. Auth via session
 * (admin only) — no CRON_SECRET needed because the request comes from
 * an authenticated admin browser, not an external scheduler.
 *
 * Calls the shared runShopifyPoll() helper directly. No internal HTTP
 * proxying — that pattern broke with empty-body responses on auth errors.
 */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { runShopifyPoll } from "@/lib/shopify/poll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  await requireRole(["admin"]);
  const result = await runShopifyPoll();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
