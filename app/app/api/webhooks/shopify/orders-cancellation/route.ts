import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ingestShopifyOrder, type ShopifyOrder } from "@/lib/shopify/ingest-order";
import {
  verifyShopifyWebhook,
  isReplay,
  wlog,
  findOrderByShopifyId,
} from "@/lib/shopify/webhook-utils";
import { writeOrderNotification } from "@/lib/notifications/write-notification";
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
 * 2. Auto-cancel only sub_orders that haven't been actioned yet
 *    (pending / assigned / unassigned / in_progress). Once sourcing has
 *    purchased, the row has financial implications (supplier refund,
 *    restock, write-off) and admin must resolve it manually — we just
 *    surface a critical notification with the count of rows that need
 *    attention.
 *
 * Why not cancel everything non-terminal: per sub-order-transitions.ts,
 * `cancelled` is admin-only territory because it has refund / restock
 * consequences. Letting Shopify drive a cancellation of a row that's
 * already been purchased online would skip the supplier-side resolution
 * step. The early-status rows (no purchase yet) have no such cost so
 * we cancel those automatically.
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

  // Only auto-cancel rows where sourcing hasn't bought anything yet.
  // Anything past in_progress has financial consequences and must be
  // resolved by admin (supplier refund, restock, write-off).
  const SAFE_TO_AUTO_CANCEL = ["pending", "assigned", "unassigned", "in_progress"];
  const sb = createServiceClient();
  const { data: cancelled } = await sb
    .from("sub_orders")
    .update({
      status: "cancelled",
      status_changed_at: new Date().toISOString(),
    })
    .eq("order_id", order.id)
    .in("status", SAFE_TO_AUTO_CANCEL)
    .select("id");

  const cancelledCount = cancelled?.length ?? 0;

  // Count rows that need admin attention. Anything past in_progress has
  // cost (supplier refund / restock / write-off / return-shipment) so admin
  // must resolve it. Includes `delivered` because in Trendlet's domain
  // language `delivered` = arrived at the Saudi customer, which on a late
  // cancellation becomes a return/refund flow that admin owns.
  const NEEDS_ADMIN = [
    "purchased_in_store",
    "purchased_online",
    "delivered_to_warehouse",
    "shipped",
    "arrived_in_ksa",
    "out_for_delivery",
    "delivered",
    "under_review",
    "preparing_for_shipment",
  ];
  const { count: needsAdminCount } = await sb
    .from("sub_orders")
    .select("id", { count: "exact", head: true })
    .eq("order_id", order.id)
    .in("status", NEEDS_ADMIN);

  const needsAdmin = needsAdminCount ?? 0;

  wlog(ctx.topic, "cancelled", {
    shopifyOrderId,
    orderId: order.id,
    subOrdersAutoCancelled: cancelledCount,
    subOrdersNeedingAdmin: needsAdmin,
    cancelReason: payload.cancel_reason,
    cancelledAt: payload.cancelled_at,
  });

  const parts: string[] = [];
  if (payload.cancel_reason) parts.push(`Reason: ${payload.cancel_reason}`);
  if (cancelledCount > 0) {
    parts.push(`${cancelledCount} sub-order${cancelledCount !== 1 ? "s" : ""} auto-cancelled`);
  }
  if (needsAdmin > 0) {
    parts.push(
      `⚠️ ${needsAdmin} sub-order${needsAdmin !== 1 ? "s" : ""} already actioned — admin review needed`,
    );
  }

  void writeOrderNotification({
    type: "order_cancelled",
    severity: "critical",
    title: `Order #${payload.order_number} was cancelled`,
    description: parts.length ? parts.join(" · ") : undefined,
    href: `/orders/${order.id}`,
  });

  return NextResponse.json({
    ok: true,
    action: "cancelled",
    order_id: order.id,
    sub_orders_auto_cancelled: cancelledCount,
    sub_orders_needs_admin: needsAdmin,
  });
}
