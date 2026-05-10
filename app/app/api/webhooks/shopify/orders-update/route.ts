import { NextResponse } from "next/server";
import { ingestShopifyOrder, type ShopifyOrder } from "@/lib/shopify/ingest-order";
import { verifyShopifyWebhook, isReplay, wlog } from "@/lib/shopify/webhook-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Shopify orders/update webhook.
 *
 * Fires whenever an order is modified (tags, addresses, notes, totals, etc.).
 * We re-sync all mutable order fields via ingestShopifyOrder with
 * updateOnDuplicate=true.  Sub-orders and assignments are NOT touched —
 * those are owned by the operations workflow.
 */
export async function POST(req: Request) {
  const verified = await verifyShopifyWebhook(req);
  if (!verified.ok) return verified.response;
  const { rawBody, ctx } = verified;

  if (await isReplay(ctx)) {
    wlog(ctx.topic, "replay_skipped", { webhookId: ctx.webhookId });
    return NextResponse.json({ ok: true, action: "noop", reason: "replay" });
  }

  let payload: ShopifyOrder;
  try {
    payload = JSON.parse(rawBody) as ShopifyOrder;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // updateOnDuplicate=true → syncs customer info, addresses, tags, notes,
  // totals, financial/fulfillment status, and raw_payload.
  const result = await ingestShopifyOrder(payload, { updateOnDuplicate: true });
  wlog(ctx.topic, result.action, { shopifyOrderId: String(payload.id) });
  return NextResponse.json({ ok: true, ...result });
}
