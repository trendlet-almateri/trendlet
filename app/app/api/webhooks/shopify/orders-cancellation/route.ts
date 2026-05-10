import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ingestShopifyOrder, type ShopifyOrder } from "@/lib/shopify/ingest-order";
import {
  verifyShopifyWebhook,
  isReplay,
  wlog,
  findOrderByShopifyId,
} from "@/lib/shopify/webhook-utils";
import type { Json } from "@/lib/types/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CancelledOrder = ShopifyOrder & {
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  financial_status?: string | null;
  refunds?: Json[];
};

/**
 * Shopify orders/cancelled webhook.
 *
 * 1. Sync order fields + raw_payload (via ingestShopifyOrder update path)
 * 2. Mark all non-terminal sub_orders for this order as "cancelled"
 *
 * Terminal statuses (delivered, returned) are not overwritten — if goods
 * were already delivered before the cancellation was processed, the
 * sub_order status reflects reality.
 */
export async function POST(req: Request) {
  const verified = await verifyShopifyWebhook(req);
  if (!verified.ok) return verified.response;
  const { rawBody, ctx } = verified;

  if (await isReplay(ctx)) {
    wlog(ctx.topic, "replay_skipped", { webhookId: ctx.webhookId });
    return NextResponse.json({ ok: true, action: "noop", reason: "replay" });
  }

  let payload: CancelledOrder;
  try {
    payload = JSON.parse(rawBody) as CancelledOrder;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const shopifyOrderId = String(payload.id);

  // Sync raw_payload + order fields
  await ingestShopifyOrder(payload, { updateOnDuplicate: true });

  const order = await findOrderByShopifyId(shopifyOrderId);
  if (!order) {
    wlog(ctx.topic, "order_not_found", { shopifyOrderId });
    return NextResponse.json({ ok: true, action: "skipped", reason: "order not in DB" });
  }

  // Mark all non-terminal sub_orders as cancelled
  const TERMINAL = ["delivered", "returned", "cancelled"];
  const sb = createServiceClient();
  const { count } = await sb
    .from("sub_orders")
    .update({
      status: "cancelled",
      status_changed_at: new Date().toISOString(),
    })
    .eq("order_id", order.id)
    .not("status", "in", `(${TERMINAL.map((s) => `"${s}"`).join(",")})`)
    .select("id", { count: "exact", head: true });

  wlog(ctx.topic, "cancelled", {
    shopifyOrderId,
    orderId: order.id,
    subOrdersCancelled: count ?? 0,
    cancelReason: payload.cancel_reason,
    cancelledAt: payload.cancelled_at,
  });

  return NextResponse.json({
    ok: true,
    action: "cancelled",
    order_id: order.id,
    sub_orders_cancelled: count ?? 0,
  });
}
