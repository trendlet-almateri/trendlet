import { NextResponse } from "next/server";
import { ingestShopifyOrder, type ShopifyOrder } from "@/lib/shopify/ingest-order";
import { verifyShopifyWebhook, isReplay, wlog, findOrderByShopifyId } from "@/lib/shopify/webhook-utils";
import { writeOrderNotification } from "@/lib/notifications/write-notification";
import { generateTaxInvoiceForOrder } from "@/lib/services/generate-tax-invoice";
import { generateCustomerInvoiceForOrder } from "@/lib/services/generate-customer-invoice";

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

  // Resolve the order even when THIS delivery didn't insert it. Shopify sends
  // orders/paid and orders/updated ~3s BEFORE orders/create on every order,
  // and orders/updated ingests the row first — so by the time orders/create
  // arrives, ingest returns "skipped" and the side effects below were never
  // reached. That is why orders had a tax invoice (poll backfill) but no
  // customer invoice and no order_created notification.
  //
  // orders/create is delivered once per order (retries are stopped by
  // isReplay above) and every side effect here is idempotent, so running them
  // on a "skipped" ingest cannot duplicate anything.
  const orderId =
    result.action === "skipped"
      ? (await findOrderByShopifyId(String(payload.id)))?.id ?? null
      : result.order_id;

  if (orderId) {
    const itemCount =
      result.action === "inserted" ? result.sub_orders_created : payload.line_items?.length ?? 0;

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
        description: `${itemCount} item${itemCount !== 1 ? "s" : ""} · ${payload.total_price ? `${payload.currency} ${payload.total_price}` : ""}`,
        href: `/orders/${orderId}`,
      });
    } catch (e) {
      console.error("[orders-create] notification failed", e);
    }

    // Auto-generate the tax invoice. Issues when pricing resolves cleanly;
    // otherwise leaves a 'needs_pricing' draft for manual completion.
    try {
      const inv = await generateTaxInvoiceForOrder(orderId);
      wlog(ctx.topic, "tax_invoice", { orderId, ...inv });
    } catch (e) {
      console.error("[orders-create] tax invoice failed", e);
    }

    // Auto-generate customer invoices — one per sub-order, born 'approved'
    // with a rendered PDF (no manual review). Manual form invoices are
    // unaffected. Idempotent, so a webhook retry can't duplicate.
    try {
      const cinv = await generateCustomerInvoiceForOrder(orderId);
      wlog(ctx.topic, "customer_invoice", { orderId, ...cinv });
    } catch (e) {
      console.error("[orders-create] customer invoice failed", e);
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
