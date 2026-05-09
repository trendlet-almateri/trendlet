import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { ingestShopifyOrder, type ShopifyOrder } from "@/lib/shopify/ingest-order";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Shopify orders/create webhook.
 *
 * Steps (all server-side, service-role client):
 *  1. Read raw body, verify HMAC-SHA256 against SHOPIFY_WEBHOOK_SECRET
 *     (constant-time compare).
 *  2. Idempotency: bail with 200 OK if shopify_order_id already exists.
 *  3. Upsert customer by shopify_customer_id (or by email fallback).
 *  4. Insert order row with raw_payload.
 *  5. For each line item: create sub_order, match brand from vendor,
 *     auto-assign if mapped. Unmatched sub-orders flip is_unassigned=true
 *     which fires the existing trg_notify_on_unassigned trigger.
 *
 * Returns 200 even on logical errors (so Shopify doesn't retry endlessly);
 * payload describes what happened.
 */
export async function POST(req: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SHOPIFY_WEBHOOK_SECRET not set" }, { status: 500 });
  }

  const signature = req.headers.get("x-shopify-hmac-sha256");
  if (!signature) {
    return NextResponse.json({ error: "missing hmac header" }, { status: 401 });
  }

  const rawBody = await req.text();
  const computed = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  // Constant-time compare; lengths must match for timingSafeEqual
  const sigBuf = Buffer.from(signature);
  const compBuf = Buffer.from(computed);
  const matches =
    sigBuf.length === compBuf.length && crypto.timingSafeEqual(sigBuf, compBuf);
  if (!matches) {
    // TEMP diagnostic — remove once webhook is verified working in production.
    // Logs only safe-to-show metadata: lengths, first/last chars of secret,
    // first/last chars of signatures. Never the full secret or full body.
    console.error("[shopify-webhook] HMAC mismatch", {
      shop_domain: req.headers.get("x-shopify-shop-domain"),
      topic: req.headers.get("x-shopify-topic"),
      webhook_id: req.headers.get("x-shopify-webhook-id"),
      api_version: req.headers.get("x-shopify-api-version"),
      secret_len: secret.length,
      secret_starts_with: secret.slice(0, 7),
      secret_ends_with: secret.slice(-4),
      secret_has_whitespace: /\s/.test(secret),
      sig_received_len: signature.length,
      sig_received_starts: signature.slice(0, 8),
      sig_received_ends: signature.slice(-4),
      sig_computed_len: computed.length,
      sig_computed_starts: computed.slice(0, 8),
      sig_computed_ends: computed.slice(-4),
      body_len: rawBody.length,
    });
    return NextResponse.json({ error: "invalid hmac" }, { status: 401 });
  }

  let payload: ShopifyOrder;
  try {
    payload = JSON.parse(rawBody) as ShopifyOrder;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const sb = createServiceClient();

  // Replay protection. Shopify sends the same X-Shopify-Webhook-Id on every
  // retry/replay; we record it once and reject duplicates.
  const webhookId = req.headers.get("x-shopify-webhook-id");
  const topic = req.headers.get("x-shopify-topic");
  if (webhookId) {
    const { error: dedupErr } = await sb.from("webhook_deliveries").insert({
      webhook_id: webhookId,
      source: "shopify",
      topic,
    });
    // 23505 = unique_violation → already processed
    if (dedupErr && (dedupErr.code === "23505" || /duplicate key/i.test(dedupErr.message ?? ""))) {
      return NextResponse.json({ ok: true, action: "noop", reason: "replay" });
    }
  }

  // Delegate to the shared ingestion helper. Webhooks don't update existing
  // rows — they only create new ones. Backfill (which DOES update) calls the
  // same helper with updateOnDuplicate=true.
  const result = await ingestShopifyOrder(payload, { updateOnDuplicate: false });
  return NextResponse.json({ ok: true, ...result });
}
