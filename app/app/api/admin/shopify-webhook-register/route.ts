/**
 * GET  /api/admin/shopify-webhook-register  → list current webhooks
 * POST /api/admin/shopify-webhook-register  → register the orders/create webhook
 *
 * Idempotent: if an orders/create subscription already exists pointing to
 * our endpoint, returns it. Otherwise creates one.
 *
 * Auth: admin only.
 */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SHOPIFY_API_VERSION = "2024-10";

type WebhookRow = {
  id: number | string;
  topic: string;
  address: string;
  format: string;
  created_at: string;
  updated_at: string;
};

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://trendlet.vercel.app"
  );
}

function getCreds() {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!shopDomain || !accessToken) {
    throw new Error("SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN must be set");
  }
  return { shopDomain, accessToken };
}

export async function GET() {
  await requireRole(["admin"]);
  let creds;
  try {
    creds = getCreds();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "creds missing" },
      { status: 500 },
    );
  }
  const { shopDomain, accessToken } = creds;

  const res = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
    {
      headers: { "X-Shopify-Access-Token": accessToken, Accept: "application/json" },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json(
      { error: "Shopify webhooks.json failed", status: res.status, message: body.slice(0, 500) },
      { status: 502 },
    );
  }
  const data = (await res.json()) as { webhooks: WebhookRow[] };
  return NextResponse.json({ ok: true, webhooks: data.webhooks ?? [] });
}

export async function POST() {
  await requireRole(["admin"]);
  let creds;
  try {
    creds = getCreds();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "creds missing" },
      { status: 500 },
    );
  }
  const { shopDomain, accessToken } = creds;

  const targetUrl = `${appUrl()}/api/webhooks/shopify/orders-create`;
  const targetTopic = "orders/create";

  // Check existing first — Shopify rejects duplicate (topic, address) pairs.
  const listRes = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json?topic=${targetTopic}`,
    {
      headers: { "X-Shopify-Access-Token": accessToken, Accept: "application/json" },
    },
  );
  if (listRes.ok) {
    const listData = (await listRes.json()) as { webhooks: WebhookRow[] };
    const existing = (listData.webhooks ?? []).find(
      (w) => w.topic === targetTopic && w.address === targetUrl,
    );
    if (existing) {
      return NextResponse.json({
        ok: true,
        action: "already_registered",
        webhook: existing,
      });
    }
  }

  // Create
  const createRes = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        webhook: {
          topic: targetTopic,
          address: targetUrl,
          format: "json",
        },
      }),
    },
  );

  if (!createRes.ok) {
    const body = await createRes.text();
    return NextResponse.json(
      {
        error: "Shopify webhook creation failed",
        status: createRes.status,
        message: body.slice(0, 500),
      },
      { status: 502 },
    );
  }
  const created = (await createRes.json()) as { webhook: WebhookRow };
  return NextResponse.json({ ok: true, action: "created", webhook: created.webhook });
}
