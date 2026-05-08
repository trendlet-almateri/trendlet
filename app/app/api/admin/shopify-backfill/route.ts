/**
 * POST /api/admin/shopify-backfill
 *
 * Pulls orders from Shopify Admin API since `since_date` and ingests them
 * into Supabase via the same path the webhook uses (lib/shopify/ingest-order).
 *
 * Behavior on duplicate (order already in DB): refreshes raw_payload +
 * headline fields (subtotal, total, addresses, notes). Does NOT touch
 * sub_orders or assignments — those are operations state.
 *
 * Auth: admin only.
 *
 * Body:
 *   since_date:  ISO date "2026-04-25" (or full timestamp). Required.
 *   status:      "any" | "open" | "closed" | "cancelled". Default: "any".
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { ingestShopifyOrder, type ShopifyOrder } from "@/lib/shopify/ingest-order";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // up to 5 min — backfills can take a while

const schema = z.object({
  since_date: z.string().min(8),
  status: z.enum(["any", "open", "closed", "cancelled"]).default("any"),
});

const SHOPIFY_API_VERSION = "2024-10";

export async function POST(req: Request) {
  await requireRole(["admin"]);

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok — uses defaults */
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!shopDomain || !accessToken) {
    return NextResponse.json(
      { error: "SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN must be set" },
      { status: 500 },
    );
  }

  // Normalize to ISO. Shopify accepts both date and full timestamp.
  const since = parsed.data.since_date.includes("T")
    ? parsed.data.since_date
    : `${parsed.data.since_date}T00:00:00Z`;

  const summary = {
    fetched: 0,
    inserted: 0,
    refreshed: 0,
    skipped: 0,
    errors: [] as { order_number: string; reason: string }[],
  };

  // Walk through paginated results. Shopify uses Link header for cursor-based
  // pagination on REST endpoints (max 250 per page).
  let url: string | null =
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?` +
    new URLSearchParams({
      status: parsed.data.status,
      created_at_min: since,
      limit: "250",
    }).toString();

  while (url) {
    const res: Response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json(
        {
          error: "Shopify orders.json fetch failed",
          status: res.status,
          message: errBody.slice(0, 500),
          summary,
        },
        { status: 502 },
      );
    }

    const data = (await res.json()) as { orders: ShopifyOrder[] };
    const orders = Array.isArray(data.orders) ? data.orders : [];
    summary.fetched += orders.length;

    for (const o of orders) {
      try {
        const result = await ingestShopifyOrder(o, { updateOnDuplicate: true });
        if (result.action === "inserted") summary.inserted++;
        else if (result.action === "refreshed") summary.refreshed++;
        else summary.skipped++;
      } catch (e) {
        summary.errors.push({
          order_number: String(o.order_number ?? o.id),
          reason: e instanceof Error ? e.message : "unknown",
        });
      }
    }

    // Parse Link header for next-page URL (Shopify REST cursor pagination)
    const link = res.headers.get("link") ?? "";
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    url = match ? match[1] : null;
  }

  return NextResponse.json({ ok: true, since, ...summary });
}
