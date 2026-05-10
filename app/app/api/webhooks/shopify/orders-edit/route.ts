import { NextResponse } from "next/server";
import { ingestShopifyOrder, type ShopifyOrder } from "@/lib/shopify/ingest-order";
import { verifyShopifyWebhook, isReplay, wlog } from "@/lib/shopify/webhook-utils";
import { writeOrderNotification } from "@/lib/notifications/write-notification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Shopify orders/edited webhook.
 *
 * Fires when an order is edited via the Shopify admin (line items added/removed,
 * quantities changed, prices adjusted). Re-syncs the full order so our DB stays
 * current with any line-item or total changes.
 *
 * Sub-orders and assignments are NOT modified here — those are managed by the
 * operations workflow and must be reconciled manually when line items change.
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

  // Re-sync all order fields including updated line items and totals
  const result = await ingestShopifyOrder(payload, { updateOnDuplicate: true });
  wlog(ctx.topic, result.action, { shopifyOrderId: String(payload.id) });

  if (result.action === "refreshed") {
    void writeOrderNotification({
      type: "order_edited",
      severity: "warning",
      title: `Order #${payload.order_number} was edited`,
      description: "Quantities or prices may have changed — check sub-orders",
      href: `/orders/${result.order_id}`,
    });
  }

  return NextResponse.json({ ok: true, ...result });
}
