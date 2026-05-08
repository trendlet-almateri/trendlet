import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { fullDateTime, relativeTime } from "@/lib/utils/date";
import { ShopifySyncControls } from "./shopify-sync-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shopify sync · Trendslet Operations" };

export default async function ShopifySyncPage() {
  await requireAdmin();
  const sb = createServiceClient();

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN ?? "";

  // Latest order in DB
  const { data: orderStats } = await sb
    .from("orders")
    .select("shopify_created_at")
    .order("shopify_created_at", { ascending: false })
    .limit(1);
  const { count: totalOrders } = await sb
    .from("orders")
    .select("*", { count: "exact", head: true });
  const latestRow = (orderStats ?? [])[0] as { shopify_created_at: string } | undefined;

  // Sync state (last poll timestamp, last run summary)
  const { data: syncRow } = shopDomain
    ? await sb
        .from("shopify_sync_state")
        .select("last_polled_at, last_run_at, last_run_summary")
        .eq("shop", shopDomain)
        .maybeSingle()
    : { data: null };
  const sync = syncRow as
    | {
        last_polled_at: string;
        last_run_at: string | null;
        last_run_summary: { ok?: boolean; fetched?: number; inserted?: number; refreshed?: number; error?: string } | null;
      }
    | null;

  const tokenSet = !!process.env.SHOPIFY_ACCESS_TOKEN;

  return (
    <div className="flex flex-col gap-5">
      <header className="rise-in flex flex-col gap-1">
        <h1 className="text-h1 text-[var(--ink)]">Shopify sync</h1>
        <p className="max-w-[640px] text-[12px] text-[var(--muted)]">
          Choose your sync strategy:{" "}
          <strong>Webhook</strong> (instant push from Shopify, requires{" "}
          <code className="mono">SHOPIFY_WEBHOOK_SECRET</code>) or{" "}
          <strong>Polling cron</strong> (every 5 min, no extra secret).
          Backfill historical orders on demand below.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <ShopifySyncControls />

        <aside className="flex flex-col gap-4">
          <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
            <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
              Status
            </h2>
            <dl className="flex flex-col gap-2 text-[12px]">
              <Row label="Shop domain" value={shopDomain || "— not set —"} ok={!!shopDomain} />
              <Row label="Access token" value={tokenSet ? "configured" : "missing"} ok={tokenSet} />
              <Row label="Orders in DB" value={String(totalOrders ?? 0)} ok={(totalOrders ?? 0) > 0} />
              <Row
                label="Latest order"
                value={latestRow ? fullDateTime(latestRow.shopify_created_at) : "—"}
                ok={!!latestRow}
              />
            </dl>
          </section>

          <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
            <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
              Auto-sync (every 5 min)
            </h2>
            {sync?.last_run_at ? (
              <dl className="flex flex-col gap-1.5 text-[12px]">
                <Row
                  label="Last run"
                  value={relativeTime(sync.last_run_at)}
                  ok={sync.last_run_summary?.ok !== false}
                />
                <Row
                  label="High water"
                  value={fullDateTime(sync.last_polled_at)}
                  ok={true}
                />
                {sync.last_run_summary && (
                  <div className="mt-1 rounded-md border border-hairline bg-surface p-2 text-[11px]">
                    {sync.last_run_summary.ok === false ? (
                      <span className="text-status-danger-fg">
                        Error: {sync.last_run_summary.error}
                      </span>
                    ) : (
                      <span className="text-ink-secondary">
                        Fetched {sync.last_run_summary.fetched ?? 0} · Inserted{" "}
                        {sync.last_run_summary.inserted ?? 0} · Refreshed{" "}
                        {sync.last_run_summary.refreshed ?? 0}
                      </span>
                    )}
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-[12px] text-ink-tertiary">
                No polls yet. Cron runs every 5 min once deployed. Use{" "}
                <em>Force poll now</em> below to trigger immediately.
              </p>
            )}
          </section>

          <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
            <h2 className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
              How it works
            </h2>
            <ul className="ml-4 flex list-disc flex-col gap-1.5 text-[11px] text-ink-secondary">
              <li>
                <strong>Auto-sync</strong>: a GitHub Actions cron hits{" "}
                <code className="mono">/api/cron/shopify-poll</code> every 5
                min. Pulls orders updated since last run, ingests them.
              </li>
              <li>
                <strong>Backfill</strong> (button): one-time pull from a date
                you choose — for missing history.
              </li>
              <li>
                <strong>Run sync now</strong> (button): manually trigger the
                same job the cron runs. Useful for testing.
              </li>
              <li>No webhook secret required — only the read access token.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-ink-tertiary">{label}</dt>
      <dd className={ok ? "mono text-ink-primary" : "mono text-status-danger-fg"}>
        {value}
      </dd>
    </div>
  );
}
