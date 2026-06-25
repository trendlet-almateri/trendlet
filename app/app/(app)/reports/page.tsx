import { ArrowDownRight, ArrowUpRight, BarChart3, MinusIcon, Trophy, Users } from "lucide-react";
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

  // Currency headline: revenue is never aggregated across currencies (§14.4).
  // The largest currency bucket becomes the headline; any others surface as
  // compact secondary cards beneath the KPI row.
  const sortedRevenue = [...revenue].sort(
    (a, b) => Number(b.total_30d) - Number(a.total_30d),
  );
  const headline = sortedRevenue[0] ?? null;
  const otherCurrencies = sortedRevenue.slice(1);

  const totalOrders = revenue.reduce((sum, r) => sum + r.order_count_30d, 0);
  const headlineGrowth =
    headline && Number(headline.prev_total) > 0
      ? ((Number(headline.total_30d) - Number(headline.prev_total)) /
          Number(headline.prev_total)) *
        100
      : headline && Number(headline.total_30d) > 0
        ? Infinity // brand-new currency this period
        : null;

  // Top brand bars share a single max so the longest fills 100%.
  const maxBrandRevenue = topBrands.length
    ? Math.max(...topBrands.map((b) => Number(b.revenue)))
    : 0;

  return (
    <div className="flex flex-1 flex-col gap-8">
      <PageHeader title="Reports" subtitle="Last 30 days · revenue, brands, and team" />

      {/* ── Section 1 — KPI overview ─────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <SectionHeader title="Overview" hint={`vs previous 30 days${headline ? ` · ${headline.currency}` : ""}`} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Revenue"
            value={headline ? formatCurrency(Number(headline.total_30d), headline.currency) : "—"}
            trend={headlineGrowth}
            primary
          />
          <KpiCard label="Orders" value={totalOrders.toLocaleString("en-US")} hint="all currencies" />
          <KpiCard
            label="Previous period"
            value={
              headline
                ? formatCurrency(Number(headline.prev_total), headline.currency)
                : "—"
            }
            muted
          />
          <KpiCard
            label="Growth"
            value={
              headlineGrowth == null
                ? "—"
                : headlineGrowth === Infinity
                  ? "New"
                  : `${headlineGrowth >= 0 ? "+" : ""}${headlineGrowth.toFixed(1)}%`
            }
            valueTone={
              headlineGrowth == null
                ? "muted"
                : headlineGrowth === Infinity || headlineGrowth >= 0
                  ? "positive"
                  : "negative"
            }
          />
        </div>

        {/* Secondary currency strip (only when ≥2 currencies, never aggregated) */}
        {otherCurrencies.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {otherCurrencies.map((r) => {
              const c =
                Number(r.prev_total) > 0
                  ? ((Number(r.total_30d) - Number(r.prev_total)) / Number(r.prev_total)) * 100
                  : null;
              return (
                <div
                  key={r.currency}
                  className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 shadow-[0_1px_2px_rgba(15,20,25,0.03)]"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      {r.currency}
                    </span>
                    <span className="text-[10.5px] text-[var(--muted)]">
                      {r.order_count_30d} orders
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="mono text-[13px] font-semibold tabular-nums text-[var(--ink)]">
                      {formatCurrency(Number(r.total_30d), r.currency)}
                    </span>
                    {c != null ? <TrendBadge value={c} compact /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      {/* ── Section 2 — Performance grid (70/30) ────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-10">
        {/* Top brands — 70% */}
        <Panel className="lg:col-span-7" title="Top brands" icon={Trophy} hint="last 30 days">
          {topBrands.length === 0 ? (
            <EmptyState fill={false} icon={BarChart3} title="No brand revenue yet" />
          ) : (
            <ul className="flex flex-col">
              {topBrands.map((b, i) => {
                const revenueNum = Number(b.revenue);
                const pct = maxBrandRevenue > 0 ? (revenueNum / maxBrandRevenue) * 100 : 0;
                return (
                  <li
                    key={`${b.brand_id}-${b.currency}`}
                    className="group grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--line)] py-3 last:border-0"
                  >
                    {/* Rank */}
                    <span className="mono text-[11px] tabular-nums text-[var(--muted-2)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    {/* Name + bar */}
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-[13px] font-medium text-[var(--ink)]">
                          {b.brand_name}
                        </span>
                        <span className="text-[11px] tabular-nums text-[var(--muted)]">
                          {b.items_count} item{b.items_count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="h-[6px] w-full overflow-hidden rounded-full bg-[var(--line-2)]">
                        <span
                          className="block h-full rounded-full bg-[var(--accent)] transition-all duration-300 group-hover:bg-[var(--accent)]/90"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Revenue (always right-aligned, tabular) */}
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="mono text-[13.5px] font-semibold tabular-nums tracking-tight text-[var(--ink)]">
                        {formatCurrency(revenueNum, b.currency)}
                      </span>
                      <span className="text-[10.5px] tabular-nums text-[var(--muted)]">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Team — 30% */}
        <Panel className="lg:col-span-3" title="Team performance" icon={Users} hint="last 30 days">
          {perf.length === 0 ? (
            <EmptyState fill={false} icon={Users} title="No completion data yet" />
          ) : (
            <ul className="flex flex-col gap-2">
              {perf.map((p) => (
                <li
                  key={p.employee_id}
                  className="group flex flex-col gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 transition-colors hover:border-[var(--line-2)] hover:bg-[var(--hover)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-[12.5px] font-semibold text-[var(--ink)]">
                        {p.full_name}
                      </span>
                      <span className="truncate text-[11px] capitalize text-[var(--muted)]">
                        {p.role}
                        {p.region ? ` · ${p.region}` : ""}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "mono shrink-0 text-[14px] font-semibold tabular-nums tracking-tight",
                        p.items_completed_30d > 0 ? "text-[var(--ink)]" : "text-[var(--muted)]",
                      )}
                    >
                      {p.items_completed_30d}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10.5px]">
                    <span className="text-[var(--muted)]">Completed</span>
                    {p.on_time_pct != null ? (
                      <span
                        className={cn(
                          "mono tabular-nums",
                          Number(p.on_time_pct) >= 90
                            ? "text-[var(--green)]"
                            : Number(p.on_time_pct) >= 70
                              ? "text-[var(--amber)]"
                              : "text-[var(--rose)]",
                        )}
                      >
                        {Number(p.on_time_pct).toFixed(0)}% on time
                      </span>
                    ) : (
                      <span className="text-[var(--muted-2)]">—</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {/* Footer note kept concise */}
      <p className="text-[11px] text-[var(--muted)]">
        Updated hourly · materialized views refresh every 15 min · revenue never aggregated across currencies.
      </p>
    </div>
  );
}

// ── Reusable presentational components ───────────────────────────────────────

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {title}
      </h2>
      {hint ? <span className="text-[11px] text-[var(--muted-2)]">{hint}</span> : null}
    </div>
  );
}

type ValueTone = "neutral" | "positive" | "negative" | "muted";

function KpiCard({
  label,
  value,
  trend,
  hint,
  primary,
  muted,
  valueTone = "neutral",
}: {
  label: string;
  value: string;
  trend?: number | null;
  hint?: string;
  primary?: boolean;
  muted?: boolean;
  valueTone?: ValueTone;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col justify-between gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_2px_rgba(15,20,25,0.03)] transition-all hover:-translate-y-[1px] hover:shadow-[0_4px_14px_-6px_rgba(15,20,25,0.10)]",
        primary && "ring-1 ring-[var(--accent)]/15",
      )}
    >
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        {label}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span
          className={cn(
            "mono text-[24px] font-semibold leading-none tabular-nums tracking-tight",
            valueTone === "positive" && "text-[var(--green)]",
            valueTone === "negative" && "text-[var(--rose)]",
            valueTone === "muted" && "text-[var(--muted)]",
            (valueTone === "neutral" || valueTone === undefined) && (muted ? "text-[var(--ink-2)]" : "text-[var(--ink)]"),
          )}
        >
          {value}
        </span>
        {trend != null ? <TrendBadge value={trend} /> : hint ? (
          <span className="text-[10.5px] text-[var(--muted-2)]">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}

function TrendBadge({ value, compact = false }: { value: number; compact?: boolean }) {
  const positive = value > 0;
  const flat = value === 0;
  const Icon = flat ? MinusIcon : value === Infinity || positive ? ArrowUpRight : ArrowDownRight;
  const tone = flat
    ? "bg-[var(--slate-bg)] text-[var(--slate)]"
    : value === Infinity || positive
      ? "bg-[var(--green-bg)] text-[var(--green)]"
      : "bg-[var(--rose-bg)] text-[var(--rose)]";
  const label = value === Infinity ? "New" : `${positive ? "+" : ""}${value.toFixed(1)}%`;
  return (
    <span
      className={cn(
        "mono inline-flex items-center gap-0.5 rounded-md tabular-nums font-medium",
        tone,
        compact ? "h-[18px] px-1.5 text-[10px]" : "h-[22px] px-2 text-[11px]",
      )}
    >
      <Icon className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3")} aria-hidden />
      {label}
    </span>
  );
}

function Panel({
  title,
  icon: Icon,
  hint,
  className,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-[16px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_1px_2px_rgba(15,20,25,0.03)]",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-[var(--muted-2)]" aria-hidden />
          <h3 className="text-[12px] font-semibold text-[var(--ink)]">{title}</h3>
        </div>
        {hint ? (
          <span className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
            {hint}
          </span>
        ) : null}
      </header>
      <div className="flex-1 p-5">{children}</div>
    </div>
  );
}
