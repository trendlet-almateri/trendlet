/**
 * Shared utilities for all Shopify webhook route handlers.
 *
 * Centralises:
 *   - HMAC-SHA256 verification (constant-time compare)
 *   - Replay / idempotency guard via webhook_deliveries table
 *   - Structured JSON logging
 *   - Finding an order in the DB by shopify_order_id
 */

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// ── Types ────────────────────────────────────────────────────────────────────

export type WebhookCtx = {
  topic: string;
  webhookId: string | null;
  shopDomain: string | null;
};

type VerifyOk = { ok: true; rawBody: string; ctx: WebhookCtx };
type VerifyFail = { ok: false; response: Response };
export type VerifyResult = VerifyOk | VerifyFail;

// ── HMAC verification ─────────────────────────────────────────────────────────

/**
 * Read the request body, verify the Shopify HMAC signature, and extract
 * context headers.  Returns the raw body + ctx on success, or a ready
 * Response (401/500) that the caller should return immediately.
 */
export async function verifyShopifyWebhook(req: Request): Promise<VerifyResult> {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    return {
      ok: false,
      response: NextResponse.json({ error: "SHOPIFY_WEBHOOK_SECRET not set" }, { status: 500 }),
    };
  }

  const signature = req.headers.get("x-shopify-hmac-sha256");
  if (!signature) {
    return {
      ok: false,
      response: NextResponse.json({ error: "missing x-shopify-hmac-sha256 header" }, { status: 401 }),
    };
  }

  const rawBody = await req.text();
  const computed = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  // Both buffers must be the same length for timingSafeEqual
  const sigBuf = Buffer.from(signature);
  const compBuf = Buffer.from(computed);
  const valid =
    sigBuf.length === compBuf.length && crypto.timingSafeEqual(sigBuf, compBuf);

  if (!valid) {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid hmac" }, { status: 401 }),
    };
  }

  return {
    ok: true,
    rawBody,
    ctx: {
      topic: req.headers.get("x-shopify-topic") ?? "",
      webhookId: req.headers.get("x-shopify-webhook-id"),
      shopDomain: req.headers.get("x-shopify-shop-domain"),
    },
  };
}

// ── Replay protection ─────────────────────────────────────────────────────────

/**
 * Insert a webhook_deliveries row.  Returns true if this delivery has already
 * been processed (duplicate key → caller should return 200 immediately).
 */
export async function isReplay(ctx: WebhookCtx): Promise<boolean> {
  if (!ctx.webhookId) return false;
  const sb = createServiceClient();
  const { error } = await sb.from("webhook_deliveries").insert({
    webhook_id: ctx.webhookId,
    source: "shopify",
    topic: ctx.topic,
  });
  return !!(
    error &&
    (error.code === "23505" || /duplicate key/i.test(error.message ?? ""))
  );
}

// ── Structured logging ────────────────────────────────────────────────────────

export function wlog(
  topic: string,
  action: string,
  data?: Record<string, unknown>,
) {
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), topic, action, ...data }),
  );
}

// ── DB helper ─────────────────────────────────────────────────────────────────

/**
 * Look up an order row by its Shopify order ID.  Returns null if not found.
 */
export async function findOrderByShopifyId(
  shopifyOrderId: string,
): Promise<{ id: string } | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("orders")
    .select("id")
    .eq("shopify_order_id", shopifyOrderId)
    .maybeSingle<{ id: string }>();
  return data ?? null;
}
