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
import { getShopifyAccessToken, getShopDomain } from "@/lib/shopify/get-access-token";

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

async function getCreds() {
  const shopDomain = getShopDomain();
  const accessToken = await getShopifyAccessToken();
  return { shopDomain, accessToken };
}

export async function GET() {
  await requireRole(["admin"]);
  let creds;
  try {
    creds = await getCreds();
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
    creds = await getCreds();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "creds missing" },
      { status: 500 },
    );
  }
  const { shopDomain, accessToken } = creds;

  // Topics we subscribe to, each mapped to its handler endpoint. Both checkout
  // topics point at the same route (idempotent upsert handles create+update).
  const SUBSCRIPTIONS: { topic: string; address: string }[] = [
    { topic: "orders/create", address: `${appUrl()}/api/webhooks/shopify/orders-create` },
    { topic: "checkouts/create", address: `${appUrl()}/api/webhooks/shopify/checkouts-create` },
    { topic: "checkouts/update", address: `${appUrl()}/api/webhooks/shopify/checkouts-create` },
  ];

  const results: Array<{ topic: string; action: string; message?: string }> = [];

  for (const { topic, address } of SUBSCRIPTIONS) {
    // Check existing first — Shopify rejects duplicate (topic, address) pairs.
    const listRes = await fetch(
      `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json?topic=${topic}`,
      { headers: { "X-Shopify-Access-Token": accessToken, Accept: "application/json" } },
    );
    if (listRes.ok) {
      const listData = (await listRes.json()) as { webhooks: WebhookRow[] };
      const existing = (listData.webhooks ?? []).find(
        (w) => w.topic === topic && w.address === address,
      );
      if (existing) {
        results.push({ topic, action: "already_registered" });
        continue;
      }
    }

    const createRes = await fetch(
      `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ webhook: { topic, address, format: "json" } }),
      },
    );

    if (!createRes.ok) {
      const body = await createRes.text();
      results.push({ topic, action: "failed", message: body.slice(0, 300) });
      continue;
    }
    results.push({ topic, action: "created" });
  }

  return NextResponse.json({
    ok: true,
    results,
    notice:
      "Webhooks registered. If any were newly created, ensure SHOPIFY_WEBHOOK_SECRET is set in Vercel env vars (Production scope). The same secret verifies all topics.",
  });
}
