import { NextResponse } from "next/server";
import { ingestShopifyOrder, type ShopifyOrder } from "@/lib/shopify/ingest-order";
import { verifyShopifyWebhook, isReplay, wlog } from "@/lib/shopify/webhook-utils";
import { writeOrderNotification } from "@/lib/notifications/write-notification";

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

  if (result.action === "refreshed" && result.order_id) {
    const orderNum = payload.order_number ?? String(payload.id);
    const fs = payload.financial_status ?? "";
    const isRefunded        = fs === "refunded";
    const isPartialRefunded = fs === "partially_refunded";

    if (isRefunded || isPartialRefunded) {
      void writeOrderNotification({
        type:        "payment_failed",
        severity:    "critical",
        title:       `Order #${orderNum} ${isRefunded ? "fully refunded" : "partially refunded"}`,
        description: `Financial status: ${fs}`,
        href:        `/orders/${result.order_id}`,
      });
    } else {
      void writeOrderNotification({
        type:        "order_updated",
        severity:    "info",
        title:       `Order ${orderNum} was updated`,
        description: "Order details synced from Shopify",
        href:        `/orders/${result.order_id}`,
      });
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
