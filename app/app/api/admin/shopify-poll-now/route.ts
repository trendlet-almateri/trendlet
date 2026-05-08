/**
 * POST /api/admin/shopify-poll-now
 *
 * Admin-only manual trigger of the same poll the cron runs. The cron
 * endpoint requires CRON_SECRET in the Authorization header, which the
 * browser can't send. This wrapper does the auth via session (admin only)
 * and calls into the cron's logic by replaying it locally.
 *
 * Implementation note: rather than re-implement the polling logic, we
 * issue an internal HTTP call to /api/cron/shopify-poll with the
 * Authorization header so we share the exact same code path.
 */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  await requireRole(["admin"]);

  const cronSecret = process.env.CRON_SECRET;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  const headers: Record<string, string> = {};
  if (cronSecret) headers.Authorization = `Bearer ${cronSecret}`;

  const res = await fetch(`${appUrl}/api/cron/shopify-poll`, {
    method: "GET",
    headers,
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
