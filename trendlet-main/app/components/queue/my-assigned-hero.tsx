import Link from "next/link";
import { CheckCircle2, ArrowRight, AlertTriangle, Clock } from "lucide-react";
import type { FulfillmentRow } from "@/lib/queries/fulfillment";
import { STATUS_BY_CODE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/utils/date";

const STATUS_PALETTE: Record<string, string> = {
  pending: "bg-status-pending-bg text-status-pending-fg border-status-pending-border/40",
  sourcing: "bg-status-sourcing-bg text-status-sourcing-fg border-status-sourcing-border/40",
  warehouse: "bg-status-warehouse-bg text-status-warehouse-fg border-status-warehouse-border/40",
  transit: "bg-status-transit-bg text-status-transit-fg border-status-transit-border/40",
  delivered: "bg-status-delivered-bg text-status-delivered-fg border-status-delivered-border/40",
  danger: "bg-status-danger-bg text-status-danger-fg border-status-danger-border/40",
};

/**
 * Top-of-page hero showing the employee what's currently assigned to them.
 * Renders only on /queue and /fulfillment for non-admins. Admins see the
 * "Admin view · all assignees" subtitle in the page header instead and
 * don't have personal assignments.
 *
 * Empty state guides the user to /admin/brands when they expect orders
 * but see none assigned (the most common cause is a missing primary
 * assignee on the brand).
 */
export function MyAssignedHero({
  rows,
  pageHref,
}: {
  /** Pre-filtered to assigned_employee_id = current user (server-side). */
  rows: FulfillmentRow[];
  /** Where the "View all" link goes — "/queue" or "/fulfillment". */
  pageHref: "/queue" | "/fulfillment";
}) {
  const total = rows.length;
  const delayed = rows.filter((r) => r.is_delayed).length;
  const atRisk = rows.filter((r) => r.is_at_risk && !r.is_delayed).length;
  const recent = [...rows]
    .sort((a, b) => (a.status_changed_at < b.status_changed_at ? 1 : -1))
    .slice(0, 3);

  return (
    <section className="rounded-lg border border-hairline bg-surface p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.6px] text-ink-tertiary">
            My assigned tasks
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink-primary tabular-nums">
              {total.toLocaleString("en-US")}
            </span>
            <span className="text-[12px] text-ink-tertiary">
              {total === 1 ? "active task" : "active tasks"}
            </span>
            {delayed > 0 && (
              <span className="inline-flex items-center gap-1 text-[12px] text-status-danger-fg">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {delayed} delayed
              </span>
            )}
            {atRisk > 0 && (
              <span className="text-[12px] text-status-sourcing-fg">
                · {atRisk} at risk
              </span>
            )}
          </div>
        </div>
      </header>

      {total === 0 ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-dashed border-hairline-strong bg-neutral-50 px-3 py-3 text-[12px] text-ink-tertiary">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
          <span>
            Nothing assigned to you right now. If you expected orders here, check{" "}
            <Link href="/admin/brands" className="text-accent hover:underline">
              /admin/brands
            </Link>{" "}
            to confirm a brand has you set as the primary assignee.
          </span>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-hairline">
          {recent.map((row) => {
            const palette = STATUS_BY_CODE[row.status]?.palette ?? "pending";
            const statusLabel = STATUS_BY_CODE[row.status]?.label ?? row.status;
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px]"
              >
                <span className="font-medium text-ink-primary truncate">
                  {row.product_title}
                </span>
                <span
                  className={cn(
                    "pill border text-[10px] flex-shrink-0",
                    STATUS_PALETTE[palette] ?? STATUS_PALETTE.pending,
                  )}
                >
                  {statusLabel}
                </span>
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-ink-tertiary">
                  <Clock className="h-3 w-3" aria-hidden />
                  {relativeTime(row.status_changed_at)}
                </span>
              </li>
            );
          })}
          {total > recent.length && (
            <li className="flex items-center justify-end pt-2">
              <Link
                href={pageHref}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
              >
                View all {total} <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
