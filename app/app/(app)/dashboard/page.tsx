import { requireAdmin } from "@/lib/auth/require-role";
import {
  fetchAdminOrders,
  fetchDashboardKpis,
  fetchRevenueByCurrency,
  fetchTeamLoad,
} from "@/lib/queries/orders";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TeamLoadCard } from "@/components/dashboard/team-load-card";
import { OrdersTable } from "@/components/orders/orders-table";
import { OrdersPipeline } from "@/components/orders/orders-pipeline";
import { formatCurrency } from "@/lib/utils/currency";
import { PageHeader } from "@/components/system";
import {
  LayoutList,
  Activity,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Clock,
  RefreshCw,
  ChevronRight,
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

  const [kpis, revenue, teamLoad, orders] = await Promise.all([
    fetchDashboardKpis(),
    fetchRevenueByCurrency(),
    fetchTeamLoad(),
    fetchAdminOrders({ limit: 5 }),
  ]);

  const headlineRevenue = revenue[0];
  const teamLoadByKey = new Map(teamLoad.map((r) => [r.team, r]));

  const totalOrders = kpis?.total_orders_30d ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            Operations overview · {totalOrders.toLocaleString("en-US")} {totalOrders === 1 ? "order" : "orders"} · last 30 days
          </>
        }
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-[11px] text-[var(--muted)] shadow-[var(--shadow-sm)]">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-[var(--green)]" aria-hidden />
            Live · synced 2 min ago
            <RefreshCw className="h-3 w-3 cursor-pointer text-[var(--muted-2)] transition-colors hover:text-[var(--ink)]" aria-hidden />
          </span>
        }
      />

      {/* KPI row — asymmetric Bento (2fr 2fr 2fr 2fr 3fr) so the hero card visibly leads */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-[2fr_2fr_2fr_2fr_3fr] lg:gap-4">
        <KpiCard
          index={0}
          icon={LayoutList}
          label="Total orders"
          value={(kpis?.total_orders_30d ?? 0).toLocaleString("en-US")}
          trend={{ direction: "up", value: "8.2%" }}
          hint="vs last 7d"
        />
        <KpiCard
          index={1}
          icon={Activity}
          label="Active"
          value={(kpis?.active_count ?? 0).toLocaleString("en-US")}
          tone="active"
          hint="In progress across teams"
          miniChart
        />
        <KpiCard
          index={2}
          icon={AlertTriangle}
          label="Delayed"
          value={(kpis?.delayed_count ?? 0).toLocaleString("en-US")}
          tone={kpis?.delayed_count ? "warn" : "default"}
          hint={`SLA at risk: ${kpis?.at_risk_count ?? 0}`}
        />
        <KpiCard
          index={3}
          icon={CheckCircle}
          label="Completed"
          value={(kpis?.completed_30d ?? 0).toLocaleString("en-US")}
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
            headlineRevenue
              ? formatCurrency(Number(headlineRevenue.total_30d), headlineRevenue.currency, { compact: true })
              : "—"
          }
          trend={{ direction: "up", value: "14.0%" }}
          hint="7-day rolling"
          miniChart
        />
      </div>

      {/* Revenue per currency — one container with hairline-divided rows
          (no FX aggregation per spec §14.4) */}
      {revenue.length > 1 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2 className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Revenue · last 30 days
            </h2>
            <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
          </div>
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

      {/* Team load */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h2 className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Team load · today
          </h2>
          <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h2 className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Recent orders
          </h2>
          <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
          <a
            href="/orders"
            className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--accent)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--hover)]"
          >
            View all
            <ChevronRight className="h-3 w-3" aria-hidden />
          </a>
        </div>
        <OrdersTable orders={orders} />
      </section>

      {/* Pipeline — same 5 orders, drag-to-pan */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h2 className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Pipeline · recent orders
          </h2>
          <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
        </div>
        <OrdersPipeline orders={orders} />
      </section>
    </div>
  );
}
