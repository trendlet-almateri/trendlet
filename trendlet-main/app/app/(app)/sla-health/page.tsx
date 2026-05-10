import { Activity } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 text-ink-primary">SLA health</h1>
        <span className="text-[12px] text-ink-tertiary">
          On-time performance across the workflow · last 30 days
        </span>
      </div>

      {totalActive === 0 ? (
        <EmptyState
          icon={Activity}
          title="No active sub-orders"
          description="SLA tracking will appear once orders are flowing through the workflow."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="rounded-md border border-hairline bg-surface p-4">
              <span className="text-hint uppercase text-ink-tertiary">Active</span>
              <div className="mt-1 text-[24px] font-medium tabular-nums text-ink-primary">{totalActive}</div>
              <div className="text-[11px] text-ink-tertiary">across all stages</div>
            </div>
            <div className="rounded-md border border-hairline bg-surface p-4">
              <span className="text-hint uppercase text-ink-tertiary">At risk</span>
              <div className={cn("mt-1 text-[24px] font-medium tabular-nums", totalAtRisk > 0 ? "text-status-sourcing-fg" : "text-ink-primary")}>{totalAtRisk}</div>
              <div className="text-[11px] text-ink-tertiary">approaching SLA</div>
            </div>
            <div className="rounded-md border border-hairline bg-surface p-4">
              <span className="text-hint uppercase text-ink-tertiary">Delayed</span>
              <div className={cn("mt-1 text-[24px] font-medium tabular-nums", totalDelayed > 0 ? "text-status-danger-fg" : "text-ink-primary")}>{totalDelayed}</div>
              <div className="text-[11px] text-ink-tertiary">past SLA</div>
            </div>
            <div className="rounded-md bg-navy-deep p-4 text-white">
              <span className="text-hint uppercase text-white/60">On time</span>
              <div className="mt-1 text-[24px] font-medium tabular-nums">
                {totalActive > 0 ? `${Math.round(((totalActive - totalAtRisk - totalDelayed) / totalActive) * 100)}%` : "—"}
              </div>
              <div className="text-[11px] text-white/70">of active items</div>
            </div>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-hint uppercase text-ink-tertiary">By stage</h2>
            <div className="overflow-hidden rounded-md border border-hairline bg-surface">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-hairline bg-neutral-50/50 text-left text-[11px] font-medium uppercase tracking-[0.4px] text-ink-tertiary">
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
                      <tr key={s.key} className="border-b border-hairline last:border-0">
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
                Note: SLA evaluation runs every 10 minutes via pg_cron and depends on <code className="rounded-sm bg-neutral-100 px-1 py-0.5">sub_orders.sla_due_at</code> being populated. Mock data has no due dates set, so no items are flagged.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
