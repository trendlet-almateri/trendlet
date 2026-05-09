/**
 * Shared polling logic. Used by:
 *   - The cron route (/api/cron/shopify-poll) for scheduled auto-sync
 *   - The admin manual trigger (/api/admin/shopify-poll-now)
 *
 * Both code paths call runShopifyPoll() directly — no internal HTTP
 * forwarding. Auth is the route's responsibility, this just does the
 * work once auth has passed.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { ingestShopifyOrder, type ShopifyOrder } from "./ingest-order";

const SHOPIFY_API_VERSION = "2024-10";
const OVERLAP_MS = 60 * 1000;

export type PollSummary = {
  ok: boolean;
  since: string;
  last_polled_at?: string;
  fetched: number;
  inserted: number;
  refreshed: number;
  skipped: number;
  errors: { order_number: string; reason: string }[];
  error?: string;
};

/**
 * Run a single poll cycle: fetch orders updated since last poll, ingest,
 * advance the high-water mark.
 */
export async function runShopifyPoll(): Promise<PollSummary> {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!shopDomain || !accessToken) {
    return {
      ok: false,
      error: "SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN required",
      since: "",
      fetched: 0,
      inserted: 0,
      refreshed: 0,
      skipped: 0,
      errors: [],
    };
  }

  const sb = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stateRow } = await (sb.from("shopify_sync_state") as any)
    .select("last_polled_at")
    .eq("shop", shopDomain)
    .maybeSingle();
  const lastPolled = stateRow?.last_polled_at ?? "2026-01-01T00:00:00Z";

  const since = new Date(new Date(lastPolled).getTime() - OVERLAP_MS).toISOString();
  const runStartedAt = new Date().toISOString();

  const summary: PollSummary = {
    ok: true,
    since,
    fetched: 0,
    inserted: 0,
    refreshed: 0,
    skipped: 0,
    errors: [],
  };

  let url: string | null =
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?` +
    new URLSearchParams({
      status: "any",
      updated_at_min: since,
      limit: "250",
    }).toString();

  let maxOrderUpdatedAt = lastPolled;

  while (url) {
    const res: Response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from("shopify_sync_state") as any).upsert(
        {
          shop: shopDomain,
          last_run_at: runStartedAt,
          last_run_summary: {
            ...summary,
            ok: false,
            error: `Shopify ${res.status}`,
            message: errBody.slice(0, 500),
          },
        },
        { onConflict: "shop" },
      );
      return {
        ...summary,
        ok: false,
        error: `Shopify ${res.status}: ${errBody.slice(0, 300)}`,
      };
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
        const u = o.updated_at ?? o.created_at;
        if (u && u > maxOrderUpdatedAt) maxOrderUpdatedAt = u;
      } catch (e) {
        summary.errors.push({
          order_number: String(o.order_number ?? o.id),
          reason: e instanceof Error ? e.message : "unknown",
        });
      }
    }

    const link = res.headers.get("link") ?? "";
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    url = match ? match[1] : null;
  }

  const newPolled =
    maxOrderUpdatedAt > runStartedAt ? maxOrderUpdatedAt : runStartedAt;
  summary.last_polled_at = newPolled;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sb.from("shopify_sync_state") as any).upsert(
    {
      shop: shopDomain,
      last_polled_at: newPolled,
      last_run_at: runStartedAt,
      last_run_summary: { ...summary, ok: true, since },
    },
    { onConflict: "shop" },
  );

  return summary;
}
