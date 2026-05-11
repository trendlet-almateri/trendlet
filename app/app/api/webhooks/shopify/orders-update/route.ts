import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ingestShopifyOrder, type ShopifyOrder } from "@/lib/shopify/ingest-order";
import { verifyShopifyWebhook, isReplay, wlog } from "@/lib/shopify/webhook-utils";
import { writeOrderNotification } from "@/lib/notifications/write-notification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Statuses that are safe to auto-cancel — no financial consequence yet.
// Must stay in sync with orders-cancellation/route.ts.
const SAFE_TO_AUTO_CANCEL = ["pending", "assigned", "unassigned", "in_progress"];

// Statuses that need admin attention after a cancellation.
const NEEDS_ADMIN_STATUSES = [
  "purchased_in_store",
  "purchased_online",
  "delivered_to_warehouse",
  "shipped",
  "delivered",
  "under_review",
  "preparing_for_shipment",
];

type UpdatePayload = ShopifyOrder & {
  cancelled_at?: string | null;
  cancel_reason?: string | null;
};

/**
 * Shopify orders/update webhook.
 *
 * Primary role: re-sync all mutable order fields.
 *
 * Fallback role: when Shopify skips orders/cancellation (e.g. the order was
 * already fully refunded), it sends orders/update with `cancelled_at` set.
 * In that case we run the same cancellation flow here so sub-orders are
 * cancelled and the critical notification fires.
 *
 * Idempotent: if all sub-orders are already cancelled we skip the
 * cancellation flow silently (handles the case where both webhooks arrive).
 */
export async function POST(req: Request) {
  const verified = await verifyShopifyWebhook(req);
  if (!verified.ok) return verified.response;
  const { rawBody, ctx } = verified;

  if (await isReplay(ctx)) {
    wlog(ctx.topic, "replay_skipped", { webhookId: ctx.webhookId });
    return NextResponse.json({ ok: true, action: "noop", reason: "replay" });
  }

  let payload: UpdatePayload;
  try {
    payload = JSON.parse(rawBody) as UpdatePayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Always sync order fields first so financial_status, cancelled_at etc.
  // are up to date in the DB before we act on them.
  const result = await ingestShopifyOrder(payload, { updateOnDuplicate: true });
  wlog(ctx.topic, result.action, { shopifyOrderId: String(payload.id) });

  if (result.action !== "refreshed" || !result.order_id) {
    return NextResponse.json({ ok: true, ...result });
  }

  const orderId  = result.order_id;
  const orderNum = payload.order_number ?? String(payload.id);

  // ── Cancellation fallback ─────────────────────────────────────────────────
  // Shopify skips orders/cancellation when the order is already fully
  // refunded. Detect it here via cancelled_at and run the same flow.
  if (payload.cancelled_at) {
    const sb = createServiceClient();

    // Idempotency: if every sub-order is already cancelled, the
    // orders/cancellation webhook already ran — nothing left to do.
    const { count: nonCancelledCount } = await sb
      .from("sub_orders")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId)
      .neq("status", "cancelled");

    if ((nonCancelledCount ?? 0) === 0) {
      wlog(ctx.topic, "cancellation_already_handled", { orderId });
      return NextResponse.json({ ok: true, ...result, cancellation: "already_handled" });
    }

    // Auto-cancel safe sub-orders (no financial consequence yet).
    // Service role has no auth.uid() — trigger requires status_changed_by explicitly.
    const { data: cancelled } = await sb
      .from("sub_orders")
      .update({
        status: "cancelled",
        status_changed_at: new Date().toISOString(),
        status_changed_by: process.env.TRENDLET_SYSTEM_USER_ID ?? "99126bae-c846-400e-9d36-7a0d34b3a1f6",
      })
      .eq("order_id", orderId)
      .in("status", SAFE_TO_AUTO_CANCEL)
      .select("id");

    const cancelledCount = cancelled?.length ?? 0;

    // Count rows that need admin attention.
    const { count: needsAdminCount } = await sb
      .from("sub_orders")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId)
      .in("status", NEEDS_ADMIN_STATUSES);

    const needsAdmin = needsAdminCount ?? 0;

    wlog(ctx.topic, "cancellation_via_update", {
      orderId,
      cancelledCount,
      needsAdmin,
      cancelReason: payload.cancel_reason,
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
      type:        "order_cancelled",
      severity:    "critical",
      title:       `Order #${orderNum} was cancelled`,
      description: parts.length ? parts.join(" · ") : undefined,
      href:        `/orders/${orderId}`,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      cancellation: "handled_via_update",
      sub_orders_auto_cancelled: cancelledCount,
      sub_orders_needs_admin: needsAdmin,
    });
  }

  // ── Normal update ─────────────────────────────────────────────────────────
  const fs                = payload.financial_status ?? "";
  const isRefunded        = fs === "refunded";
  const isPartialRefunded = fs === "partially_refunded";

  if (isRefunded || isPartialRefunded) {
    void writeOrderNotification({
      type:        "payment_failed",
      severity:    "critical",
      title:       `Order #${orderNum} ${isRefunded ? "fully refunded" : "partially refunded"}`,
      description: `Financial status: ${fs}`,
      href:        `/orders/${orderId}`,
    });
  } else {
    void writeOrderNotification({
      type:        "order_updated",
      severity:    "info",
      title:       `Order ${orderNum} was updated`,
      description: "Order details synced from Shopify",
      href:        `/orders/${orderId}`,
    });
  }

  return NextResponse.json({ ok: true, ...result });
}
