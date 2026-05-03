import { Activity } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { PageHeader } from "@/components/system";
import { createServiceClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "SLA health · Trendslet Operations" };

type Bucket = {
  total: number;
  at_risk: number;
  delayed: number;
};

export default async function SlaHealthPage() {
  await requireAdmin();
  const sb = createServiceClient();

  // Aggregate sla state per status category
  const { data, error } = await sb
    .from("sub_orders")
    .select("status, is_at_risk, is_delayed, sla_due_at")
    .limit(2000);
  if (error) console.error("[SlaHealthPage]", error);

  const rows = (data ?? []) as { status: string; is_at_risk: boolean; is_delayed: boolean; sla_due_at: string | null }[];

  // Buckets keyed by stage (sourcing / warehouse / transit / etc)
  const STAGES: { key: string; label: string; statuses: string[]; accent: string }[] = [
    { key: "sourcing", label: "Sourcing", statuses: ["under_review", "in_progress", "purchased_online", "purchased_in_store"], accent: "bg-status-sourcing-border" },
    { key: "warehouse", label: "Warehouse", statuses: ["delivered_to_warehouse", "preparing_for_shipment"], accent: "bg-status-warehouse-border" },
    { key: "transit", label: "Transit", statuses: ["shipped", "arrived_in_ksa", "out_for_delivery"], accent: "bg-status-transit-border" },
  ];

  const buckets: Record<string, Bucket> = {};
  for (const s of STAGES) {
    const items = rows.filter((r) => s.statuses.includes(r.status));
    buckets[s.key] = {
      total: items.length,
      at_risk: items.filter((i) => i.is_at_risk).length,
      delayed: items.filter((i) => i.is_delayed).length,
    };
  }

  const totalActive = rows.filter((r) =>
    r.status !== "delivered" && r.status !== "cancelled" && r.status !== "returned" && r.status !== "failed",
  ).length;
  const totalAtRisk = rows.filter((r) => r.is_at_risk).length;
  const totalDelayed = rows.filter((r) => r.is_delayed).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="SLA health" subtitle="On-time performance across the workflow · last 30 days" />

      {totalActive === 0 ? (
        <EmptyState
          icon={Activity}
          title="No active sub-orders"
          description="SLA tracking will appear once orders are flowing through the workflow."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Active</span>
              <div className="mt-1 text-[24px] font-semibold tabular-nums text-[var(--ink)]">{totalActive}</div>
              <div className="text-[11px] text-[var(--muted)]">across all stages</div>
            </div>
            <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">At risk</span>
              <div className={cn("mt-1 text-[24px] font-semibold tabular-nums", totalAtRisk > 0 ? "text-status-sourcing-fg" : "text-[var(--ink)]")}>{totalAtRisk}</div>
              <div className="text-[11px] text-[var(--muted)]">approaching SLA</div>
            </div>
            <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Delayed</span>
              <div className={cn("mt-1 text-[24px] font-semibold tabular-nums", totalDelayed > 0 ? "text-status-danger-fg" : "text-[var(--ink)]")}>{totalDelayed}</div>
              <div className="text-[11px] text-[var(--muted)]">past SLA</div>
            </div>
            <div className="rounded-[var(--radius)] bg-navy-deep p-4 text-white shadow-[var(--shadow-sm)]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">On time</span>
              <div className="mt-1 text-[24px] font-medium tabular-nums">
                {totalActive > 0 ? `${Math.round(((totalActive - totalAtRisk - totalDelayed) / totalActive) * 100)}%` : "—"}
              </div>
              <div className="text-[11px] text-white/70">of active items</div>
            </div>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">By stage</h2>
            <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--hover)] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    <th className="px-4 py-2 font-medium">Stage</th>
                    <th className="px-3 py-2 text-right font-medium">Active</th>
                    <th className="px-3 py-2 text-right font-medium">At risk</th>
                    <th className="px-3 py-2 text-right font-medium">Delayed</th>
                    <th className="px-3 py-2 text-right font-medium">On time</th>
                  </tr>
                </thead>
                <tbody>
                  {STAGES.map((s) => {
                    const b = buckets[s.key];
                    const onTime = b.total > 0 ? Math.round(((b.total - b.at_risk - b.delayed) / b.total) * 100) : null;
                    return (
                      <tr key={s.key} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--hover)]">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <span className={cn("h-1.5 w-1.5 rounded-full", s.accent)} aria-hidden />
                            {s.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-ink-primary">{b.total}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-status-sourcing-fg">{b.at_risk || "—"}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-status-danger-fg">{b.delayed || "—"}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-ink-primary">{onTime != null ? `${onTime}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalDelayed === 0 && totalAtRisk === 0 && (
              <p className="text-[11px] text-ink-tertiary">
                Note: SLA evaluation runs every 10 minutes via pg_cron and depends on <code className="rounded-sm bg-[var(--hover)] px-1 py-0.5">sub_orders.sla_due_at</code> being populated. Mock data has no due dates set, so no items are flagged.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
