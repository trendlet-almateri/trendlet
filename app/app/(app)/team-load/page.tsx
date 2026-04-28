import { Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { fetchTeamLoad } from "@/lib/queries/orders";
import { createServiceClient } from "@/lib/supabase/server";
import { TeamLoadCard } from "@/components/dashboard/team-load-card";
import { EmptyState } from "@/components/common/empty-state";

export const dynamic = "force-dynamic";

export const metadata = { title: "Team load · Trendslet Operations" };

const TEAM_META: Record<string, { label: string; description: string; accent: string }> = {
  sourcing: { label: "Sourcing", description: "to source", accent: "bg-status-sourcing-border" },
  warehouse: { label: "Warehouse", description: "to pack", accent: "bg-status-warehouse-border" },
  fulfiller: { label: "EU fulfillment", description: "dual cycle", accent: "bg-status-transit-border" },
  ksa_operator: { label: "KSA last-mile", description: "deliveries", accent: "bg-status-delivered-border" },
};

const TEAM_ORDER = ["sourcing", "warehouse", "fulfiller", "ksa_operator"];

type TeamPerf = {
  employee_id: string;
  full_name: string;
  region: string | null;
  role: string;
  items_completed_30d: number;
  on_time_pct: number | null;
};

export default async function TeamLoadPage() {
  await requireAdmin();
  const sb = createServiceClient();

  const [teamLoad, perfRes] = await Promise.all([
    fetchTeamLoad(),
    sb.from("mv_team_performance_30d").select("*").order("items_completed_30d", { ascending: false }),
  ]);
  const perf = (perfRes.data ?? []) as unknown as TeamPerf[];

  const teamLoadByKey = new Map(teamLoad.map((r) => [r.team, r]));
  const totalActive = teamLoad.reduce((sum, r) => sum + (r.active_items ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 text-ink-primary">Team load</h1>
        <span className="text-[12px] text-ink-tertiary">Workload distribution across teams · live</span>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-hint uppercase text-ink-tertiary">By team</h2>
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
        {totalActive === 0 && (
          <p className="text-[11px] text-ink-tertiary">
            All zeros until non-admin employees are invited and assigned to sub-orders. Admin-only assignments don&rsquo;t bucket into these team rows.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-hint uppercase text-ink-tertiary">By employee · last 30 days</h2>
        {perf.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No employee performance data"
            description="Performance metrics populate as employees complete sub-orders."
          />
        ) : (
          <div className="overflow-hidden rounded-md border border-hairline bg-surface">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-hairline bg-neutral-50/50 text-left text-[11px] font-medium uppercase tracking-[0.4px] text-ink-tertiary">
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Region</th>
                  <th className="px-3 py-2 text-right font-medium">Completed</th>
                  <th className="px-3 py-2 text-right font-medium">On time</th>
                </tr>
              </thead>
              <tbody>
                {perf.map((p) => (
                  <tr key={p.employee_id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3 font-medium text-ink-primary">{p.full_name}</td>
                    <td className="px-3 py-3 capitalize text-ink-secondary">{p.role}</td>
                    <td className="px-3 py-3 text-ink-secondary">{p.region ?? "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-primary">{p.items_completed_30d}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-primary">
                      {p.on_time_pct != null ? `${Number(p.on_time_pct).toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
