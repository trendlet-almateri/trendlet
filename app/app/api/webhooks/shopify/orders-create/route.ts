import { NextResponse } from "next/server";
import { ingestShopifyOrder, type ShopifyOrder } from "@/lib/shopify/ingest-order";
import { verifyShopifyWebhook, isReplay, wlog } from "@/lib/shopify/webhook-utils";
import { writeOrderNotification } from "@/lib/notifications/write-notification";
import { generateTaxInvoiceForOrder } from "@/lib/services/generate-tax-invoice";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Shopify orders/create webhook.
 *
 * 1. Verify HMAC
 * 2. Replay protection via webhook_deliveries
 * 3. Delegate to ingestShopifyOrder (idempotent insert)
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

  let payload: ShopifyOrder;
  try {
    payload = JSON.parse(rawBody) as ShopifyOrder;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const result = await ingestShopifyOrder(payload, { updateOnDuplicate: false });
  wlog(ctx.topic, result.action, { shopifyOrderId: String(payload.id) });

  if (result.action === "inserted") {
    void writeOrderNotification({
      type: "order_created",
      severity: "info",
      title: `New order #${payload.order_number} received`,
      description: `${result.sub_orders_created} item${result.sub_orders_created !== 1 ? "s" : ""} · ${payload.total_price ? `${payload.currency} ${payload.total_price}` : ""}`,
      href: `/orders/${result.order_id}`,
    });

    // Auto-generate the tax invoice. Fire-and-forget so a pricing/PDF hiccup
    // never blocks the webhook 200. Issues when pricing resolves cleanly;
    // otherwise leaves a 'needs_pricing' draft for manual completion.
    void generateTaxInvoiceForOrder(result.order_id).then((r) => {
      wlog(ctx.topic, "tax_invoice", { orderId: result.order_id, ...r });
    });
  }

  return NextResponse.json({ ok: true, ...result });
}
