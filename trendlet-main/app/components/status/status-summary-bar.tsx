import { STATUS_BY_CODE, type StatusCode } from "@/lib/constants";
import { cn } from "@/lib/utils";

type SubOrderLite = {
  status: StatusCode | string;
  is_unassigned: boolean;
};

const PALETTE_BG: Record<string, string> = {
  sourcing: "bg-status-sourcing-border",
  warehouse: "bg-status-warehouse-border",
  transit: "bg-status-transit-border",
  delivered: "bg-status-delivered-border",
  pending: "bg-status-pending-border",
  danger: "bg-status-danger-border",
  success: "bg-status-success-border",
};

/**
 * Multi-color proportional bar of sub-order statuses + inline list below.
 * Per spec: "▒▒▒▒▒░░░░░░░░░ · 2 Pend · 1 Prog"
 */
export function StatusSummaryBar({ subOrders }: { subOrders: SubOrderLite[] }) {
  if (!subOrders.length) {
    return <span className="text-[11px] text-ink-tertiary">No sub-orders</span>;
  }

  const buckets = new Map<string, { palette: string; count: number; label: string }>();
  for (const so of subOrders) {
    const key = so.is_unassigned ? "unassigned" : so.status;
    const meta = so.is_unassigned
      ? { palette: "danger", label: "Unassigned" }
      : STATUS_BY_CODE[so.status] ?? { palette: "pending", label: so.status };
    const cur = buckets.get(key);
    if (cur) {
      cur.count += 1;
    } else {
      buckets.set(key, { palette: meta.palette, label: meta.label, count: 1 });
    }
  }

  const total = subOrders.length;
  const segments = Array.from(buckets.values()).sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col gap-1">
      <div
        role="img"
        aria-label={segments.map((s) => `${s.count} ${s.label}`).join(", ")}
        className="flex h-1.5 w-full overflow-hidden rounded-sm bg-neutral-100"
      >
        {segments.map((seg, i) => (
          <span
            key={i}
            className={cn("h-full", PALETTE_BG[seg.palette])}
            style={{ width: `${(seg.count / total) * 100}%` }}
          />
        ))}
      </div>
      <span className="text-[11px] text-ink-tertiary">
        {segments.map((s, i) => (
          <span key={i}>
            {i > 0 && " · "}
            {s.count} {s.label}
          </span>
        ))}
      </span>
    </div>
  );
}
