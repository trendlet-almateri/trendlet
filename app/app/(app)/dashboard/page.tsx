import { requireAdmin } from "@/lib/auth/require-role";
import {
  fetchAdminOrders,
  fetchDashboardKpis,
  fetchRevenueByCurrency,
  fetchTeamLoad,
  fetchTopBrands,
} from "@/lib/queries/orders";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { CountUp } from "@/components/dashboard/count-up";
import { TeamLoadCard } from "@/components/dashboard/team-load-card";
import { RecentOrdersSection } from "./recent-orders";
import { OrdersPipeline } from "@/components/orders/orders-pipeline";
import { formatCurrency } from "@/lib/utils/currency";
import { PageHeader, RealtimeRefresh, SectionHeader } from "@/components/system";
import {
  LayoutList,
  Activity,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Users,
  Package,
  GitBranch,
  ChevronRight,
  Tag,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard · Trendslet Operations" };

const TEAM_META: Record<string, { label: string; description: string; accent: string }> = {
  sourcing: { label: "Sourcing", description: "to source", accent: "bg-status-sourcing-border" },
  warehouse: { label: "Warehouse", description: "to pack", accent: "bg-status-warehouse-border" },
  fulfiller: { label: "EU fulfillment", description: "dual cycle", accent: "bg-status-transit-border" },
  ksa_operator: { label: "KSA last-mile", description: "deliveries", accent: "bg-status-delivered-border" },
};

const TEAM_ORDER = ["sourcing", "warehouse", "fulfiller", "ksa_operator"];

export default async function DashboardPage() {
  await requireAdmin();

  const [kpis, revenue, teamLoad, orders, brands] = await Promise.all([
    fetchDashboardKpis(),
    fetchRevenueByCurrency(),
    fetchTeamLoad(),
    fetchAdminOrders({ limit: 5 }),
    fetchTopBrands(),
  ]);

  // Bars are scaled to the busiest brand, so the leader always fills the row.
  // brands arrives sorted by items_count, so [0] is the max.
  const topBrandItems = brands.length ? brands[0].items_count : 0;
  const totalBrandItems = brands.reduce((sum, b) => sum + b.items_count, 0);
  // A brand needs setup if nobody owns it, or it has no region — without a
  // region the enforce_brand_region guard is off and a US brand can be given
  // to an EU employee with no error.
  const brandsNeedingSetup = brands.filter((b) => !b.has_owner || !b.region).length;

  const headlineRevenue = revenue[0];
  const teamLoadByKey = new Map(teamLoad.map((r) => [r.team, r]));

  const totalOrders = kpis?.total_orders_30d ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard"
        subtitle="Monitor orders, team workload, revenue and operational health in one place."
      />

      {/* KPI row — asymmetric Bento (2fr 2fr 2fr 2fr 3fr) so the hero card visibly
          leads. 1-col mobile, 2-up tablet, 5-up desktop. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_2fr_2fr_3fr]">
        <KpiCard
          index={0}
          icon={LayoutList}
          label="Total orders"
          value={<CountUp value={kpis?.total_orders_30d ?? 0} />}
          trend={{ direction: "up", value: "8.2%" }}
          hint="vs last 7d"
        />
        <KpiCard
          index={1}
          icon={Activity}
          label="Active"
          value={<CountUp value={kpis?.active_count ?? 0} />}
          tone="active"
          hint="In progress across teams"
          miniChart
        />
        <KpiCard
          index={2}
          icon={AlertTriangle}
          label="Delayed"
          value={<CountUp value={kpis?.delayed_count ?? 0} />}
          tone={kpis?.delayed_count ? "warn" : "default"}
          hint={`SLA at risk: ${kpis?.at_risk_count ?? 0}`}
        />
        <KpiCard
          index={3}
          icon={CheckCircle}
          label="Completed"
          value={<CountUp value={kpis?.completed_30d ?? 0} />}
          tone="success"
          trend={{ direction: "up", value: "4.1%" }}
          hint={kpis?.on_time_pct != null ? `On-time rate ${Number(kpis.on_time_pct).toFixed(1)}%` : "—"}
        />
        <KpiCard
          index={4}
          hero
          icon={DollarSign}
          label="Gross processed"
          value={
            headlineRevenue ? (
              <CountUp
                value={Number(headlineRevenue.total_30d)}
                currency={headlineRevenue.currency}
                compact
              />
            ) : (
              "—"
            )
          }
          trend={{ direction: "up", value: "14.0%" }}
          hint="7-day rolling"
          miniChart
        />
      </div>

      {/* Revenue per currency — one container with hairline-divided rows
          (no FX aggregation per spec §14.4) */}
      {revenue.length > 1 && (
        <section className="flex flex-col gap-4">
          <SectionHeader label="Revenue · last 30 days" icon={DollarSign} />
          <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm),inset_0_1px_0_rgba(255,255,255,0.8)]">
            <ul className="divide-y divide-[var(--line)]">
              {revenue.map((r) => (
                <li
                  key={r.currency}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--hover)]"
                >
                  <span className="w-10 shrink-0 text-[10px] font-bold uppercase tracking-[0.6px] text-[var(--muted)]">
                    {r.currency}
                  </span>
                  <span className="h-3.5 w-px shrink-0 bg-[var(--line)]" aria-hidden />
                  <span className="mono flex-1 text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--ink)]">
                    {formatCurrency(Number(r.total_30d), r.currency, { compact: false })}
                  </span>
                  <span className="mono shrink-0 text-[11px] tabular-nums text-[var(--muted)]">
                    {r.order_count_30d.toLocaleString("en-US")} {r.order_count_30d === 1 ? "order" : "orders"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Every brand we have ordered from, all time, busiest first. The bar is
          scaled to the biggest brand so the mix reads without parsing numbers. */}
      {brands.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHeader
            label={`Brands · all orders — ${brands.length} brands · ${totalBrandItems.toLocaleString("en-US")} items`}
            icon={Tag}
            action={
              brandsNeedingSetup > 0 ? (
                <a
                  href="/admin/brands"
                  className="inline-flex items-center gap-0.5 rounded-full border border-[var(--amber)]/40 bg-[var(--amber-bg)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--amber)] shadow-[var(--shadow-sm)] transition-colors hover:brightness-95"
                >
                  {brandsNeedingSetup} need setup
                  <ChevronRight className="h-3 w-3" aria-hidden />
                </a>
              ) : undefined
            }
          />
          <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm),inset_0_1px_0_rgba(255,255,255,0.8)]">
            <ul className="divide-y divide-[var(--line)]">
              {brands.map((b) => {
                const share = topBrandItems > 0 ? (b.items_count / topBrandItems) * 100 : 0;
                return (
                  <li
                    key={b.brand_id}
                    className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--hover)]"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-[var(--ink)]">
                        {b.brand_name}
                      </span>
                      {b.region ? (
                        <span
                          title={`${b.region} brand`}
                          className="shrink-0 rounded-full border border-[var(--line)] px-1.5 py-px text-[10px] font-medium text-[var(--muted)]"
                        >
                          {b.region}
                        </span>
                      ) : (
                        <span
                          title="No region — the US/EU check is off, so this brand can be assigned to the wrong team"
                          className="shrink-0 rounded-full border border-[var(--amber)]/40 bg-[var(--amber-bg)] px-1.5 py-px text-[10px] font-medium text-[var(--amber)]"
                        >
                          no region
                        </span>
                      )}
                      {!b.has_owner && (
                        <span
                          title="No employee owns this brand — its items stay unassigned"
                          className="shrink-0 rounded-full border border-[var(--amber)]/40 bg-[var(--amber-bg)] px-1.5 py-px text-[10px] font-medium text-[var(--amber)]"
                        >
                          no owner
                        </span>
                      )}
                    </span>
                    <span
                      className="hidden h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-[var(--line)] sm:block"
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${Math.max(share, 3)}%` }}
                      />
                    </span>
                    <span className="mono shrink-0 text-[11px] tabular-nums text-[var(--muted)]">
                      {b.items_count} {b.items_count === 1 ? "item" : "items"}
                      <span className="hidden sm:inline">
                        {" · "}{b.orders_count} {b.orders_count === 1 ? "order" : "orders"}
                      </span>
                    </span>
                    <span className="mono w-28 shrink-0 text-right text-[14px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--ink)]">
                      {formatCurrency(Number(b.revenue), b.currency, { compact: false })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* Team load */}
      <section className="flex flex-col gap-4">
        <SectionHeader label="Team load · today" icon={Users} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM_ORDER.map((key, i) => {
            const row = teamLoadByKey.get(key);
            const meta = TEAM_META[key];
            return (
              <TeamLoadCard
                key={key}
                index={i}
                team={meta.label}
                memberCount={row?.member_count ?? 0}
                activeCount={row?.active_items ?? 0}
                description={meta.description}
                loadPercent={row?.load_percent ?? 0}
                accent={meta.accent}
              />
            );
          })}
        </div>
      </section>

      {/* Recent orders table (5 most recent) */}
      <section className="flex flex-col gap-4">
        <SectionHeader
          label="Recent orders"
          icon={Package}
          action={
            <a
              href="/orders"
              className="inline-flex items-center gap-0.5 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--accent)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--hover)]"
            >
              View all
              <ChevronRight className="h-3 w-3" aria-hidden />
            </a>
          }
        />
        <RecentOrdersSection orders={orders} />
      </section>

      {/* Pipeline — same 5 orders, drag-to-pan */}
      <section className="flex flex-col gap-4">
        <SectionHeader label="Pipeline · recent orders" icon={GitBranch} />
        <OrdersPipeline orders={orders} />
      </section>
      <RealtimeRefresh />
    </div>
  );
}
