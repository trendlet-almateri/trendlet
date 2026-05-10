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

type PaidOrder = ShopifyOrder & {
  financial_status?: string | null; // paid | refunded | partially_paid | partially_refunded | voided | pending
  payment_gateway?: string | null;
  refunds?: Json[];
  total_price?: string | null;
  subtotal_price?: string | null;
};

/**
 * Shopify orders/paid webhook.
 *
 * Fires on payment events: paid, partially_paid, refunded, partially_refunded, voided.
 *
 * Syncs:
 *   - financial_status → stored in raw_payload
 *   - updated totals (total, subtotal)
 *   - refund data via raw_payload
 *
 * We don't have a dedicated financial_status column; the raw_payload is the
 * source of truth for financial data. Query it with:
 *   raw_payload->>'financial_status'
 */
export async function POST(req: Request) {
  const verified = await verifyShopifyWebhook(req);
  if (!verified.ok) return verified.response;
  const { rawBody, ctx } = verified;

  if (await isReplay(ctx)) {
    wlog(ctx.topic, "replay_skipped", { webhookId: ctx.webhookId });
    return NextResponse.json({ ok: true, action: "noop", reason: "replay" });
  }

  let payload: PaidOrder;
  try {
    payload = JSON.parse(rawBody) as PaidOrder;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const shopifyOrderId = String(payload.id);

  // Sync raw_payload + totals via the shared update path
  await ingestShopifyOrder(payload, { updateOnDuplicate: true });

  const order = await findOrderByShopifyId(shopifyOrderId);
  if (!order) {
    wlog(ctx.topic, "order_not_found", { shopifyOrderId });
    return NextResponse.json({ ok: true, action: "skipped", reason: "order not in DB" });
  }

  // Additionally sync totals (in case the refund changed the total)
  const sb = createServiceClient();
  await sb
    .from("orders")
    .update({
      total: payload.total_price ? Number(payload.total_price) : undefined,
      subtotal: payload.subtotal_price ? Number(payload.subtotal_price) : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  wlog(ctx.topic, "payment_synced", {
    shopifyOrderId,
    orderId: order.id,
    financialStatus: payload.financial_status,
    total: payload.total_price,
  });

  return NextResponse.json({
    ok: true,
    action: "payment_synced",
    order_id: order.id,
    financial_status: payload.financial_status,
  });
}
