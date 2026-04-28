import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

type Currency = "SAR" | "USD" | "EUR" | "GBP" | "AED";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Single-store fallback. Override with TRENDLET_STORE_ID env var when going multi-store.
const TRENDLET_STORE_ID =
  process.env.TRENDLET_STORE_ID ?? "db563070-bbf7-4b75-b256-0b93fd44a56f";

type ShopifyAddress = {
  first_name?: string | null;
  last_name?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  zip?: string | null;
  phone?: string | null;
};

type ShopifyLineItem = {
  id: number | string;
  product_id?: number | string | null;
  variant_id?: number | string | null;
  title: string;
  variant_title?: string | null;
  sku?: string | null;
  quantity: number;
  price: string; // shopify ships decimal as string
  vendor?: string | null;
  image_url?: string | null;
};

type ShopifyOrder = {
  id: number | string;
  order_number: number | string;
  email?: string | null;
  currency: string;
  subtotal_price?: string | null;
  total_price?: string | null;
  customer?: {
    id?: number | string | null;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  } | null;
  shipping_address?: ShopifyAddress | null;
  billing_address?: ShopifyAddress | null;
  line_items: ShopifyLineItem[];
  created_at: string;
  note?: string | null;
};

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
  if (sigBuf.length !== compBuf.length || !crypto.timingSafeEqual(sigBuf, compBuf)) {
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

  const shopifyOrderId = String(payload.id);

  // Idempotency by shopify order id (belt-and-suspenders alongside webhook-id dedup)
  const { data: existing } = await sb
    .from("orders")
    .select("id")
    .eq("shopify_order_id", shopifyOrderId)
    .maybeSingle<{ id: string }>();
  if (existing) {
    return NextResponse.json({ ok: true, action: "noop", reason: "already ingested" });
  }

  // Customer upsert
  let customerId: string | null = null;
  if (payload.customer) {
    const c = payload.customer;
    const shopifyCustomerId = c.id ? String(c.id) : null;
    if (shopifyCustomerId) {
      const customerRow = {
        store_id: TRENDLET_STORE_ID,
        shopify_customer_id: shopifyCustomerId,
        email: c.email ?? null,
        first_name: c.first_name ?? null,
        last_name: c.last_name ?? null,
        phone: c.phone ?? payload.shipping_address?.phone ?? null,
        default_address: (payload.shipping_address ?? null) as Json,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cust } = await (sb.from("customers") as any)
        .upsert(customerRow, { onConflict: "shopify_customer_id" })
        .select("id")
        .maybeSingle();
      customerId = (cust as { id: string } | null)?.id ?? null;
    }
  }

  // Order insert
  const orderRow = {
    store_id: TRENDLET_STORE_ID,
    shopify_order_id: shopifyOrderId,
    shopify_order_number: String(payload.order_number),
    customer_id: customerId,
    subtotal: payload.subtotal_price ? Number(payload.subtotal_price) : null,
    total: payload.total_price ? Number(payload.total_price) : null,
    currency: payload.currency as Currency,
    shipping_address: (payload.shipping_address ?? null) as Json,
    billing_address: (payload.billing_address ?? null) as Json,
    notes: payload.note ?? null,
    raw_payload: payload as unknown as Json,
    shopify_created_at: payload.created_at,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderRaw, error: orderErr } = await (sb.from("orders") as any)
    .insert(orderRow)
    .select("id")
    .maybeSingle();
  const order = orderRaw as { id: string } | null;

  if (orderErr || !order) {
    console.error("[shopify webhook] order insert failed", orderErr);
    return NextResponse.json({ ok: false, error: orderErr?.message ?? "order insert failed" });
  }

  // Sub-orders + brand matching + auto-assign
  const subOrderResults: { sub_order_id: string; assigned_to: string | null }[] = [];
  for (let i = 0; i < payload.line_items.length; i++) {
    const li = payload.line_items[i];
    const subOrderNumber = `${payload.order_number}-${String(i + 1).padStart(2, "0")}`;

    // Brand match (case-insensitive, fuzzy via match_brand_from_vendor RPC)
    let brandId: string | null = null;
    if (li.vendor) {
      const { data: brand } = await sb.rpc("match_brand_from_vendor", { p_vendor: li.vendor });
      brandId = (brand as string | null) ?? null;
    }

    const subRow = {
      order_id: order.id,
      sub_order_number: subOrderNumber,
      shopify_line_item_id: String(li.id),
      product_title: li.title,
      variant_title: li.variant_title ?? null,
      sku: li.sku ?? null,
      quantity: li.quantity,
      product_image_url: li.image_url ?? null,
      unit_price: li.price ? Number(li.price) : null,
      currency: payload.currency as Currency,
      brand_id: brandId,
      brand_name_raw: li.vendor ?? null,
      is_unassigned: !brandId,
      status: "pending",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: subRaw, error: subErr } = await (sb.from("sub_orders") as any)
      .insert(subRow)
      .select("id")
      .maybeSingle();
    const sub = subRaw as { id: string } | null;

    if (subErr || !sub) {
      console.error("[shopify webhook] sub_order insert failed", subErr);
      continue;
    }

    // Auto-assign if brand matched and brand has an assignment.
    let assignedTo: string | null = null;
    if (brandId) {
      const { data: assignedId } = await sb.rpc("auto_assign_sub_order", { p_sub_order_id: sub.id });
      assignedTo = (assignedId as string | null) ?? null;
    }
    subOrderResults.push({ sub_order_id: sub.id, assigned_to: assignedTo });
  }

  return NextResponse.json({
    ok: true,
    order_id: order.id,
    sub_orders: subOrderResults,
  });
}
