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
import { formatCurrency } from "@/lib/utils/currency";
import {
  LayoutList,
  Activity,
  AlertTriangle,
  CheckCircle,
  DollarSign,
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
    fetchAdminOrders({ limit: 25 }),
  ]);

  const headlineRevenue = revenue[0];
  const teamLoadByKey = new Map(teamLoad.map((r) => [r.team, r]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-ink-primary">Dashboard</h1>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          icon={LayoutList}
          label="Total orders"
          value={(kpis?.total_orders_30d ?? 0).toLocaleString("en-US")}
          trend={{ direction: "up", value: "8.2%" }}
          hint="vs last 7d"
        />
        <KpiCard
          icon={Activity}
          label="Active"
          value={(kpis?.active_count ?? 0).toLocaleString("en-US")}
          tone="active"
          hint="In progress across teams"
          miniChart
        />
        <KpiCard
          icon={AlertTriangle}
          label="Delayed"
          value={(kpis?.delayed_count ?? 0).toLocaleString("en-US")}
          tone={kpis?.delayed_count ? "danger" : "default"}
          hint={`SLA at risk: ${kpis?.at_risk_count ?? 0}`}
        />
        <KpiCard
          icon={CheckCircle}
          label="Completed"
          value={(kpis?.completed_30d ?? 0).toLocaleString("en-US")}
          tone="success"
          trend={{ direction: "up", value: "4.1%" }}
          hint={kpis?.on_time_pct != null ? `On-time rate ${Number(kpis.on_time_pct).toFixed(1)}%` : "—"}
        />
        <KpiCard
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

      {/* Revenue per currency (no FX aggregation per spec §14.4) */}
      {revenue.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-hint uppercase text-ink-tertiary">Revenue · last 30 days</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {revenue.map((r) => (
              <div
                key={r.currency}
                className="flex flex-col gap-0.5 rounded-md border border-hairline bg-surface p-3"
              >
                <span className="text-[11px] font-medium uppercase tracking-[0.4px] text-ink-tertiary">
                  {r.currency}
                </span>
                <span className="text-[16px] font-medium tabular-nums text-ink-primary">
                  {formatCurrency(Number(r.total_30d), r.currency, { compact: true })}
                </span>
                <span className="text-[11px] text-ink-tertiary tabular-nums">
                  {r.order_count_30d} {r.order_count_30d === 1 ? "order" : "orders"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Team load */}
      <section className="flex flex-col gap-2">
        <h2 className="text-hint uppercase text-ink-tertiary">Team load · today</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {TEAM_ORDER.map((key) => {
            const row = teamLoadByKey.get(key);
            const meta = TEAM_META[key];
            return (
              <TeamLoadCard
                key={key}
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

      {/* Orders table */}
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-hint uppercase text-ink-tertiary">Recent orders</h2>
          <a href="/orders" className="text-[12px] text-navy hover:underline">
            View all →
          </a>
        </div>
        <OrdersTable orders={orders} />
      </section>
    </div>
  );
}
