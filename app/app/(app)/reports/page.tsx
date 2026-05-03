import { BarChart3 } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { PageHeader } from "@/components/system";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchRevenueByCurrency } from "@/lib/queries/orders";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

// ISR: revalidate the page every hour. Reports rely on materialized views
// that themselves refresh every 15 min via pg_cron, so 1h cache is safe.
export const revalidate = 3600;

export const metadata = { title: "Reports · Trendslet Operations" };

type TopBrand = {
  brand_id: string;
  brand_name: string;
  currency: string;
  items_count: number;
  revenue: number;
};

type TeamPerf = {
  employee_id: string;
  full_name: string;
  region: string | null;
  role: string;
  items_completed_30d: number;
  on_time_pct: number | null;
};

export default async function ReportsPage() {
  await requireAdmin();
  const sb = createServiceClient();

  const [revenue, topBrandsRes, perfRes] = await Promise.all([
    fetchRevenueByCurrency(),
    sb.from("mv_top_brands_30d").select("*").order("revenue", { ascending: false }).limit(10),
    sb.from("mv_team_performance_30d").select("*").order("items_completed_30d", { ascending: false }).limit(10),
  ]);

  const topBrands = (topBrandsRes.data ?? []) as unknown as TopBrand[];
  const perf = (perfRes.data ?? []) as unknown as TeamPerf[];

  const totalOrders = revenue.reduce((sum, r) => sum + r.order_count_30d, 0);
  const maxBrandRevenue = topBrands.length ? Math.max(...topBrands.map((b) => Number(b.revenue))) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reports" subtitle="Revenue, profit, and team performance · last 30 days" />

      {/* Revenue by currency */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Revenue by currency</h2>
        {revenue.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No revenue yet"
            description="Revenue data populates as orders are completed."
          />
        ) : (
          <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--hover)] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  <th className="px-4 py-2 font-medium">Currency</th>
                  <th className="px-3 py-2 text-right font-medium">Orders 30d</th>
                  <th className="px-3 py-2 text-right font-medium">Revenue 30d</th>
                  <th className="px-3 py-2 text-right font-medium">Prev period</th>
                  <th className="px-3 py-2 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {revenue.map((r) => {
                  const change = r.prev_total > 0 ? ((Number(r.total_30d) - Number(r.prev_total)) / Number(r.prev_total)) * 100 : null;
                  return (
                    <tr key={r.currency} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--hover)]">
                      <td className="px-4 py-3 font-medium text-ink-primary">{r.currency}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-primary">{r.order_count_30d}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-primary">
                        {formatCurrency(Number(r.total_30d), r.currency)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-tertiary">
                        {formatCurrency(Number(r.prev_total), r.currency)}
                      </td>
                      <td className={cn(
                        "px-3 py-3 text-right tabular-nums",
                        change == null ? "text-ink-tertiary" : change >= 0 ? "text-status-success-fg" : "text-status-danger-fg",
                      )}>
                        {change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-ink-tertiary">
          Per spec §14.4: revenue is never aggregated across currencies. Each row is standalone.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top brands */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Top brands · last 30 days</h2>
          {topBrands.length === 0 ? (
            <EmptyState icon={BarChart3} title="No brand revenue yet" />
          ) : (
            <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
              <ul className="flex flex-col gap-3">
                {topBrands.map((b) => {
                  const pct = maxBrandRevenue > 0 ? (Number(b.revenue) / maxBrandRevenue) * 100 : 0;
                  return (
                    <li key={`${b.brand_id}-${b.currency}`} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-medium text-ink-primary">{b.brand_name}</span>
                        <span className="tabular-nums text-ink-secondary">
                          {formatCurrency(Number(b.revenue), b.currency)}
                          <span className="ml-1 text-[11px] text-ink-tertiary">· {b.items_count} items</span>
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-[var(--line)]">
                        <span className="block h-full bg-navy" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        {/* Team performance */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Team performance · last 30 days</h2>
          {perf.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No completion data yet"
              description="Performance metrics populate as employees complete sub-orders."
            />
          ) : (
            <div className="rounded-md border border-hairline bg-surface">
              <ul className="flex flex-col">
                {perf.map((p) => (
                  <li key={p.employee_id} className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 last:border-0 hover:bg-[var(--hover)]">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[13px] font-medium text-ink-primary">{p.full_name}</span>
                      <span className="text-[11px] capitalize text-ink-tertiary">
                        {p.role} {p.region ? `· ${p.region}` : ""}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 text-right tabular-nums">
                      <span className="text-[13px] text-ink-primary">{p.items_completed_30d} done</span>
                      {p.on_time_pct != null && (
                        <span className="text-[11px] text-ink-tertiary">
                          {Number(p.on_time_pct).toFixed(0)}% on time
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="text-[11px] text-ink-tertiary">
        Reports cache for 1 hour (ISR). Underlying materialized views refresh every 15 minutes via pg_cron.
      </div>
    </div>
  );
}
