import { NextResponse } from "next/server";
import { verifyShopifyWebhook, isReplay, wlog } from "@/lib/shopify/webhook-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Shopify orders/delete webhook.
 *
 * Fires when an order is permanently deleted from Shopify (rare — only test
 * orders or orders deleted via API). We deliberately do NOT delete the order
 * from our DB: historical records, sub_orders, and financials must be preserved
 * for operations and accounting.
 *
 * This handler only exists to acknowledge the webhook so Shopify doesn't retry
 * and eventually disable the endpoint.
 */
export async function POST(req: Request) {
  const verified = await verifyShopifyWebhook(req);
  if (!verified.ok) return verified.response;
  const { rawBody, ctx } = verified;

  if (await isReplay(ctx)) {
    wlog(ctx.topic, "replay_skipped", { webhookId: ctx.webhookId });
    return NextResponse.json({ ok: true, action: "noop", reason: "replay" });
  }

  let shopifyOrderId: string;
  try {
    const payload = JSON.parse(rawBody) as { id?: number | string };
    shopifyOrderId = String(payload.id ?? "unknown");
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // No deletion — we retain all historical order data
  wlog(ctx.topic, "deletion_acknowledged", { shopifyOrderId });
  return NextResponse.json({ ok: true, action: "acknowledged", shopify_order_id: shopifyOrderId });
}
