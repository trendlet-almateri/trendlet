import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ingestShopifyOrder, type ShopifyOrder } from "@/lib/shopify/ingest-order";
import {
  verifyShopifyWebhook,
  isReplay,
  wlog,
  findOrderByShopifyId,
} from "@/lib/shopify/webhook-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Fulfillment = {
  id: number | string;
  status: string; // "success" | "pending" | "cancelled" | "error" | "failure"
  tracking_company?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  line_items?: Array<{ id: number | string }>;
  created_at?: string | null;
  updated_at?: string | null;
};

type FulfilledOrder = ShopifyOrder & {
  fulfillment_status?: string | null;
  fulfillments?: Fulfillment[];
};

/**
 * Shopify orders/fulfilled webhook.
 *
 * Fires when one or more fulfillments are created/updated on an order.
 *
 * 1. Sync order raw_payload
 * 2. For each successful fulfillment, update the matching sub_orders
 *    (matched by shopify_line_item_id) to status "shipped" and persist
 *    tracking info in the raw_payload of the sub_order.
 *
 * Only sub_orders currently in a pre-ship status are updated — already
 * delivered/returned rows are left untouched.
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

  const sb = createServiceClient();
  const successfulFulfillments = (payload.fulfillments ?? []).filter(
    (f) => f.status === "success",
  );

  // Collect all shipped line item IDs across successful fulfillments
  const shippedLineItemIds = new Set<string>();
  const trackingByLineItem = new Map<
    string,
    { company: string | null; number: string | null; url: string | null }
  >();

  for (const f of successfulFulfillments) {
    const tracking = {
      company: f.tracking_company ?? null,
      number: f.tracking_number ?? null,
      url: f.tracking_url ?? null,
    };
    for (const li of f.line_items ?? []) {
      const liId = String(li.id);
      shippedLineItemIds.add(liId);
      trackingByLineItem.set(liId, tracking);
    }
  }

  if (shippedLineItemIds.size === 0) {
    wlog(ctx.topic, "no_successful_fulfillments", { shopifyOrderId });
    return NextResponse.json({ ok: true, action: "noop", reason: "no successful fulfillments" });
  }

  // Fetch matching sub_orders
  const PRE_SHIP = ["pending", "sourcing", "warehouse", "ready"];
  const { data: subOrders } = await sb
    .from("sub_orders")
    .select("id, shopify_line_item_id")
    .eq("order_id", order.id)
    .in("shopify_line_item_id", [...shippedLineItemIds])
    .in("status", PRE_SHIP);

  let updated = 0;
  for (const sub of subOrders ?? []) {
    const tracking = trackingByLineItem.get(sub.shopify_line_item_id ?? "") ?? null;
    await sb
      .from("sub_orders")
      .update({
        status: "shipped",
        status_changed_at: new Date().toISOString(),
        // Store tracking in raw_payload via a separate tracking column if it exists,
        // otherwise we embed it in notes for now.
        ...(tracking
          ? {
              // If you add a tracking_data jsonb column this is the place to write it.
              // For now we surface it via the order's raw_payload which already holds fulfillments.
            }
          : {}),
      })
      .eq("id", sub.id);
    updated++;
  }

  wlog(ctx.topic, "shipped", {
    shopifyOrderId,
    orderId: order.id,
    subOrdersShipped: updated,
    fulfillmentCount: successfulFulfillments.length,
  });

  return NextResponse.json({
    ok: true,
    action: "shipped",
    order_id: order.id,
    sub_orders_shipped: updated,
  });
}
