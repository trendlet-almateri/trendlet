/**
 * GET /api/cron/shopify-poll
 *
 * Runs every 5 minutes via Vercel Cron. Fetches Shopify orders updated
 * since the last successful poll and ingests them into Supabase. This
 * is the auto-sync mechanism — no webhooks, no SHOPIFY_WEBHOOK_SECRET,
 * just steady polling using the read-only access token.
 *
 * Idempotency: ingestShopifyOrder upserts on shopify_order_id, so even
 * if we re-poll the same window we don't duplicate. We use a small
 * overlap (60s) on every poll to make sure clock skew or in-flight
 * orders never slip through the gap.
 *
 * Auth: Vercel Cron sends a CRON_SECRET in the Authorization header.
 * Reject anything else.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ingestShopifyOrder, type ShopifyOrder } from "@/lib/shopify/ingest-order";
import { getShopifyAccessToken, getShopDomain } from "@/lib/shopify/get-access-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SHOPIFY_API_VERSION = "2024-10";

// Overlap window: when we poll, we go back this far before last_polled_at
// to absorb clock skew + in-flight orders Shopify hadn't indexed at the
// previous poll. ingest is idempotent so re-fetching a few orders is fine.
const OVERLAP_MS = 60 * 1000;

export async function GET(req: Request) {
  // Vercel Cron header check (also accept manual trigger from the admin page
  // via session cookie when CRON_SECRET is missing for local dev).
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (cronSecret) {
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const t0 = Date.now();
  let shopDomain: string;
  let accessToken: string;
  try {
    shopDomain = getShopDomain();
    accessToken = await getShopifyAccessToken();
  } catch (e) {
    console.error("[shopify-poll] auth failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Shopify auth failed" },
      { status: 500 },
    );
  }

  const sb = createServiceClient();

  // Read or create sync state row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stateRow } = await (sb.from("shopify_sync_state") as any)
    .select("last_polled_at")
    .eq("shop", shopDomain)
    .maybeSingle();
  const lastPolled = stateRow?.last_polled_at ?? "2026-01-01T00:00:00Z";

  // Compute query window with overlap
  const since = new Date(new Date(lastPolled).getTime() - OVERLAP_MS).toISOString();
  const runStartedAt = new Date().toISOString();

  const summary = {
    fetched: 0,
    inserted: 0,
    refreshed: 0,
    skipped: 0,
    errors: [] as { order_number: string; reason: string }[],
  };

  // Use updated_at_min so we catch order edits too (cancellations, refunds,
  // address changes — not just new orders). status=any to include closed.
  let url: string | null =
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?` +
    new URLSearchParams({
      status: "any",
      updated_at_min: since,
      limit: "50",
      order: "updated_at asc", // oldest-first so the watermark advances monotonically
    }).toString();

  let maxOrderUpdatedAt = lastPolled;

  // Stay well under Vercel's 60s function limit. On a large backlog we process
  // what we can within budget, advance the watermark to the last order handled,
  // and let the next run continue — self-draining, never times out.
  const BUDGET_MS = 40_000;
  let budgetHit = false;

  while (url) {
    const res: Response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      // Persist the failed run so the admin page surfaces it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from("shopify_sync_state") as any).upsert(
        {
          shop: shopDomain,
          last_run_at: runStartedAt,
          last_run_summary: {
            ok: false,
            error: `Shopify ${res.status}`,
            message: errBody.slice(0, 500),
            ...summary,
          },
        },
        { onConflict: "shop" },
      );
      return NextResponse.json(
        { error: "Shopify orders.json fetch failed", status: res.status, message: errBody.slice(0, 500), summary },
        { status: 502 },
      );
    }

    const data = (await res.json()) as { orders: (ShopifyOrder & { updated_at?: string })[] };
    const orders = Array.isArray(data.orders) ? data.orders : [];
    summary.fetched += orders.length;

    for (const o of orders) {
      try {
        const result = await ingestShopifyOrder(o, { updateOnDuplicate: true });
        if (result.action === "inserted") summary.inserted++;
        else if (result.action === "refreshed") summary.refreshed++;
        else summary.skipped++;
        // Track the high-water mark so next poll resumes here
        const u = (o.updated_at ?? o.created_at);
        if (u && u > maxOrderUpdatedAt) maxOrderUpdatedAt = u;
      } catch (e) {
        summary.errors.push({
          order_number: String(o.order_number ?? o.id),
          reason: e instanceof Error ? e.message : "unknown",
        });
      }
      // Time budget: stop cleanly and let the next run resume from here.
      if (Date.now() - t0 > BUDGET_MS) { budgetHit = true; break; }
    }

    if (budgetHit) break;

    const link = res.headers.get("link") ?? "";
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    url = match ? match[1] : null;
  }

  console.log(`[shopify-poll] done in ${Date.now() - t0}ms fetched=${summary.fetched} ingested=${summary.inserted + summary.refreshed} budgetHit=${budgetHit} newWatermark=${maxOrderUpdatedAt}`);

  // Advance the high-water mark.
  // - Partial run (budget hit): resume exactly from the last order we processed,
  //   so the unprocessed remainder isn't skipped.
  // - Full drain: bump to the later of (max order updated_at, runStartedAt) so
  //   an empty window still advances and we don't refetch forever.
  const newPolled = budgetHit
    ? maxOrderUpdatedAt
    : maxOrderUpdatedAt > runStartedAt
    ? maxOrderUpdatedAt
    : runStartedAt;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from("shopify_sync_state") as any).upsert(
    {
      shop: shopDomain,
      last_polled_at: newPolled,
      last_run_at: runStartedAt,
      last_run_summary: { ok: true, since, ...summary },
    },
    { onConflict: "shop" },
  );

  return NextResponse.json({ ok: true, since, last_polled_at: newPolled, ...summary });
}
