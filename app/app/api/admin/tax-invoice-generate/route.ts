/**
 * POST /api/admin/tax-invoice-generate   { order_id: "<uuid>" }
 *
 * Manually (re)run generateTaxInvoiceForOrder for one order and return its
 * result — used to backfill orders whose webhook-time generation was lost, and
 * to diagnose why an order produced no invoice. Idempotent (the service itself
 * checks for an existing invoice + UNIQUE(order_id)).
 *
 * Auth: Bearer CRON_SECRET (same token the GitHub poll uses).
 */
import { NextResponse } from "next/server";
import { generateTaxInvoiceForOrder } from "@/lib/services/generate-tax-invoice";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let orderId: string | undefined;
  try {
    orderId = (await req.json())?.order_id;
  } catch {
    /* ignore */
  }
  if (!orderId) {
    return NextResponse.json({ error: "order_id required" }, { status: 400 });
  }

  try {
    const result = await generateTaxInvoiceForOrder(orderId);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack?.slice(0, 1200) : undefined,
      },
      { status: 500 },
    );
  }
}
