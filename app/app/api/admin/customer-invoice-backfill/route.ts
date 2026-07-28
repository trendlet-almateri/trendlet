/**
 * POST /api/admin/customer-invoice-backfill
 *   { batchSize?: number }  → approve + render PDF for up to batchSize DRAFT
 *                             customer invoices. Call repeatedly until the
 *                             response `remaining` is 0.
 *
 * One-time backfill for the bulk-generated draft invoices. PDF rendering is
 * slow (headless Chrome), so it's batched to stay under the serverless timeout.
 *
 * Auth: Bearer CRON_SECRET (same token the other admin routes use).
 */
import { NextResponse } from "next/server";
import { approveRenderDrafts } from "@/lib/services/approve-render-drafts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { batchSize?: number } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    /* ignore */
  }

  try {
    const result = await approveRenderDrafts(body.batchSize ?? 20);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
