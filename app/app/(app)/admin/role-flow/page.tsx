import { requireAdmin } from "@/lib/auth/require-role";
import { STATUSES, ROLE_STATUS_WHITELIST, type StatusCode } from "@/lib/constants";
import { getNextStatuses, type Role } from "@/lib/workflow/sub-order-transitions";
import { TWILIO_STATUS_TEMPLATES } from "@/lib/integrations/twilio-templates";
import { PageHeader } from "@/components/system";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Role flow preview · Trendslet" };

const NON_ADMIN_ROLES: Role[] = ["sourcing", "warehouse", "fulfiller", "ksa_operator"];

const ROLE_META: Record<Role, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-red-50 text-red-700 border-red-200" },
  sourcing: { label: "Sourcing", color: "bg-amber-50 text-amber-800 border-amber-200" },
  warehouse: { label: "Warehouse", color: "bg-blue-50 text-blue-800 border-blue-200" },
  fulfiller: { label: "EU fulfiller", color: "bg-purple-50 text-purple-800 border-purple-200" },
  ksa_operator: { label: "KSA operator", color: "bg-green-50 text-green-800 border-green-200" },
};

export default async function RoleFlowPage() {
  await requireAdmin();

  const lifecycleOrder: StatusCode[] = [
    "pending",
    "under_review",
    "in_progress",
    "purchased_online",
    "purchased_in_store",
    "out_of_stock",
    "delivered_to_warehouse",
    "preparing_for_shipment",
    "shipped",
    "arrived_in_ksa",
    "out_for_delivery",
    "delivered",
    "returned",
    "cancelled",
    "failed",
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Role flow preview"
        subtitle="What each role sees in the status dropdown at every lifecycle step. Mirrors the same functions the live UI uses."
      />

      <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 p-4 text-[12px] text-amber-900">
        <p className="font-semibold">Read-only preview · admin-only</p>
        <p className="mt-1">
          Computed from the same client constants the live dropdowns read:{" "}
          <code className="rounded bg-white/60 px-1">ROLE_STATUS_WHITELIST</code>,{" "}
          <code className="rounded bg-white/60 px-1">getNextStatuses()</code>,{" "}
          <code className="rounded bg-white/60 px-1">TWILIO_STATUS_TEMPLATES</code>.
          Doesn't query the DB — it shows what the UI would render, not what the DB
          trigger would accept. Mismatches between the two are bugs to flag.
        </p>
      </div>

      {NON_ADMIN_ROLES.map((role) => (
        <RoleSection key={role} role={role} lifecycleOrder={lifecycleOrder} />
      ))}
    </div>
  );
}

function RoleSection({
  role,
  lifecycleOrder,
}: {
  role: Role;
  lifecycleOrder: StatusCode[];
}) {
  const meta = ROLE_META[role];
  const whitelist = ROLE_STATUS_WHITELIST[role] ?? [];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-semibold",
            meta.color,
          )}
        >
          {meta.label}
        </span>
        <span className="text-[11px] text-[var(--muted)]">
          Whitelist: {whitelist.length} status{whitelist.length === 1 ? "" : "es"} ·{" "}
          {whitelist.join(", ") || "—"}
        </span>
      </div>

      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)]">
        <table className="w-full text-[12px]">
          <thead className="bg-[var(--bg)]/50 text-[10px] uppercase tracking-[0.4px] text-[var(--muted)]">
            <tr>
              <th className="w-[22%] px-4 py-2 text-left font-medium">If sub-order is at…</th>
              <th className="px-4 py-2 text-left font-medium">…dropdown shows</th>
              <th className="w-[34%] px-4 py-2 text-left font-medium">Customer would receive</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {lifecycleOrder.map((current) => {
              const next = getNextStatuses(current, role, ROLE_STATUS_WHITELIST);
              return (
                <tr key={current} className="align-top">
                  <td className="px-4 py-3 font-mono text-[11px] text-[var(--ink)]">
                    {current}
                  </td>
                  <td className="px-4 py-3">
                    {next.length === 0 ? (
                      <span className="text-[11px] italic text-[var(--muted-2)]">
                        No actions
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {next.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-0.5 font-mono text-[11px] text-[var(--ink)]"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {next.length === 0 ? (
                      <span className="text-[11px] text-[var(--muted-2)]">—</span>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {next.map((target) => {
                          const tpl =
                            target in TWILIO_STATUS_TEMPLATES
                              ? TWILIO_STATUS_TEMPLATES[target as keyof typeof TWILIO_STATUS_TEMPLATES]
                              : null;
                          return (
                            <div
                              key={target}
                              className="rounded border border-[var(--line)] bg-[var(--bg)] p-2 text-[11px]"
                              dir="rtl"
                              lang="ar"
                            >
                              {tpl ? (
                                <span className="text-[var(--ink)]">{tpl.bodyAr}</span>
                              ) : (
                                <span className="italic text-[var(--muted-2)]" dir="ltr" lang="en">
                                  → {target}: silent (no customer notification)
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
