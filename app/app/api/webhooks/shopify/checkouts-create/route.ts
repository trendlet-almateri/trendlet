import { NextResponse } from "next/server";
import { ingestAbandonedCheckout, type ShopifyCheckout } from "@/lib/shopify/ingest-checkout";
import { verifyShopifyWebhook, isReplay, wlog } from "@/lib/shopify/webhook-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Shopify checkouts/create + checkouts/update webhook (abandoned checkouts).
 *
 * 1. Verify HMAC
 * 2. Replay protection via webhook_deliveries
 * 3. Upsert into abandoned_checkouts (idempotent on shopify_checkout_id, so
 *    create + update both route here and the update is just a refresh)
 *
 * Always returns 200 on logical errors so Shopify doesn't retry endlessly.
 */
export async function POST(req: Request) {
  const verified = await verifyShopifyWebhook(req);
  if (!verified.ok) return verified.response;
  const { rawBody, ctx } = verified;

  if (await isReplay(ctx)) {
    wlog(ctx.topic, "replay_skipped", { webhookId: ctx.webhookId });
    return NextResponse.json({ ok: true, action: "noop", reason: "replay" });
  }

  let payload: ShopifyCheckout;
  try {
    payload = JSON.parse(rawBody) as ShopifyCheckout;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const result = await ingestAbandonedCheckout(payload);
  wlog(ctx.topic, result.action, { shopifyCheckoutId: String(payload.id) });

  return NextResponse.json({ ok: true, ...result });
}
