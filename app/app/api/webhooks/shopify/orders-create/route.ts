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
    // AWAIT both side effects — on Vercel, promises left pending after the
    // response returns are not guaranteed to run (no waitUntil in Next 14.2),
    // which is why earlier orders ingested but never got an invoice. Each is
    // wrapped so a failure still returns 200 (no Shopify retry-storm); invoice
    // generation is idempotent (existing-row check + UNIQUE(order_id)), so a
    // Shopify retry can't create a duplicate. Total added latency ~1-2s, well
    // under Shopify's webhook timeout.
    try {
      await writeOrderNotification({
        type: "order_created",
        severity: "info",
        title: `New order #${payload.order_number} received`,
        description: `${result.sub_orders_created} item${result.sub_orders_created !== 1 ? "s" : ""} · ${payload.total_price ? `${payload.currency} ${payload.total_price}` : ""}`,
        href: `/orders/${result.order_id}`,
      });
    } catch (e) {
      console.error("[orders-create] notification failed", e);
    }

    // Auto-generate the tax invoice. Issues when pricing resolves cleanly;
    // otherwise leaves a 'needs_pricing' draft for manual completion.
    try {
      const inv = await generateTaxInvoiceForOrder(result.order_id);
      wlog(ctx.topic, "tax_invoice", { orderId: result.order_id, ...inv });
    } catch (e) {
      console.error("[orders-create] tax invoice failed", e);
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
