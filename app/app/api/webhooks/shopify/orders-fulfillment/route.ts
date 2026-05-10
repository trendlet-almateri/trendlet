import { NextResponse } from "next/server";
import { ingestShopifyOrder, type ShopifyOrder } from "@/lib/shopify/ingest-order";
import {
  verifyShopifyWebhook,
  isReplay,
  wlog,
  findOrderByShopifyId,
} from "@/lib/shopify/webhook-utils";
import { writeOrderNotification } from "@/lib/notifications/write-notification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Fulfillment = {
  id: number | string;
  status: string; // "success" | "pending" | "cancelled" | "error" | "failure"
};

type FulfilledOrder = ShopifyOrder & {
  fulfillment_status?: string | null;
  fulfillments?: Fulfillment[];
};

/**
 * Shopify orders/fulfilled webhook.
 *
 * Fires when one or more fulfillments are created/updated on an order in
 * Shopify (e.g. an admin manually marks the order fulfilled).
 *
 * Sub-order status (pending → … → shipped → delivered) is owned by the
 * Trendlet operations workflow (sourcing → warehouse → fulfiller). The
 * "shipped" transition belongs to the warehouse role and must NOT be
 * overwritten by Shopify-side fulfillment events, which would otherwise
 * shortcut a `pending` row straight to `shipped` and skip every
 * intermediate step.
 *
 * This handler therefore only:
 *   1. Verifies HMAC + replay-protects
 *   2. Refreshes raw_payload via ingestShopifyOrder (so the Timeline tab
 *      reflects the Shopify-side fulfillment event)
 *   3. Emits an info notification for visibility
 *
 * It does NOT touch sub_order.status.
 */
export async function POST(req: Request) {
  const verified = await verifyShopifyWebhook(req);
  if (!verified.ok) return verified.response;
  const { rawBody, ctx } = verified;

  if (await isReplay(ctx)) {
    wlog(ctx.topic, "replay_skipped", { webhookId: ctx.webhookId });
    return NextResponse.json({ ok: true, action: "noop", reason: "replay" });
  }

  let payload: FulfilledOrder;
  try {
    payload = JSON.parse(rawBody) as FulfilledOrder;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const shopifyOrderId = String(payload.id);
  await ingestShopifyOrder(payload, { updateOnDuplicate: true });

  const order = await findOrderByShopifyId(shopifyOrderId);
  if (!order) {
    wlog(ctx.topic, "order_not_found", { shopifyOrderId });
    return NextResponse.json({ ok: true, action: "skipped", reason: "order not in DB" });
  }

  const successfulCount = (payload.fulfillments ?? []).filter(
    (f) => f.status === "success",
  ).length;

  wlog(ctx.topic, "recorded", {
    shopifyOrderId,
    orderId: order.id,
    successfulFulfillments: successfulCount,
  });

  void writeOrderNotification({
    type: "order_fulfilled",
    severity: "info",
    title: `Fulfillment recorded for order #${payload.order_number}`,
    description: `Shopify reported ${successfulCount} successful fulfillment${successfulCount !== 1 ? "s" : ""}. Sub-order status is unchanged — warehouse owns the shipped transition.`,
    href: `/orders/${order.id}`,
  });

  return NextResponse.json({
    ok: true,
    action: "recorded",
    order_id: order.id,
    successful_fulfillments: successfulCount,
  });
}
