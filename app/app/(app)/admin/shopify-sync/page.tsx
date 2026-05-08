import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { fullDateTime } from "@/lib/utils/date";
import { ShopifySyncControls } from "./shopify-sync-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shopify sync · Trendslet Operations" };

export default async function ShopifySyncPage() {
  await requireAdmin();
  const sb = createServiceClient();

  // Quick diagnostic snapshot — used to color-code the status panel.
  const { data: orderStats } = await sb
    .from("orders")
    .select("shopify_created_at", { count: "exact", head: false })
    .order("shopify_created_at", { ascending: false })
    .limit(1);

  const { count: totalOrders } = await sb
    .from("orders")
    .select("*", { count: "exact", head: true });

  const latestRow = (orderStats ?? [])[0] as { shopify_created_at: string } | undefined;

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN ?? "";
  const tokenSet = !!process.env.SHOPIFY_ACCESS_TOKEN;
  const webhookSecretSet = !!process.env.SHOPIFY_WEBHOOK_SECRET;

  return (
    <div className="flex flex-col gap-5">
      <header className="rise-in flex flex-col gap-1">
        <h1 className="text-h1 text-[var(--ink)]">Shopify sync</h1>
        <p className="max-w-[640px] text-[12px] text-[var(--muted)]">
          Pull historical orders from Shopify into Supabase, and register the
          live webhook so new orders flow in automatically as customers buy.
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
              <Row
                label="Shop domain"
                value={shopDomain || "— not set —"}
                ok={!!shopDomain}
              />
              <Row
                label="Access token"
                value={tokenSet ? "configured" : "missing"}
                ok={tokenSet}
              />
              <Row
                label="Webhook secret"
                value={webhookSecretSet ? "configured" : "missing"}
                ok={webhookSecretSet}
              />
              <Row
                label="Orders in DB"
                value={String(totalOrders ?? 0)}
                ok={(totalOrders ?? 0) > 0}
              />
              <Row
                label="Latest order"
                value={
                  latestRow ? fullDateTime(latestRow.shopify_created_at) : "—"
                }
                ok={!!latestRow}
              />
            </dl>
          </section>

          <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
            <h2 className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
              How sync works
            </h2>
            <ul className="ml-4 flex list-disc flex-col gap-1.5 text-[11px] text-ink-secondary">
              <li>
                <strong>Backfill</strong> grabs all orders from Shopify since
                the date you pick. Existing rows get their{" "}
                <code className="mono">raw_payload</code> refreshed; new rows
                are inserted.
              </li>
              <li>
                <strong>Register webhook</strong> tells Shopify to push every
                future <code className="mono">orders/create</code> to this
                app. After that, no clicks needed — orders flow live.
              </li>
              <li>
                Run backfill first, then register the webhook. Together = full
                history + live future.
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-ink-tertiary">{label}</dt>
      <dd
        className={
          ok
            ? "mono text-ink-primary"
            : "mono text-status-danger-fg"
        }
      >
        {value}
      </dd>
    </div>
  );
}
