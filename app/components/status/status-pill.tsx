import { STATUS_BY_CODE, type StatusCode } from "@/lib/constants";
import { cn } from "@/lib/utils";

type StatusPillProps = {
  status: StatusCode | string;
  isUnassigned?: boolean;
  className?: string;
  /** Show a small colored dot before the label. Default true. */
  showDot?: boolean;
};

const PALETTE_CLASSES: Record<string, string> = {
  sourcing: "bg-status-sourcing-bg text-status-sourcing-fg border-status-sourcing-border/40",
  warehouse: "bg-status-warehouse-bg text-status-warehouse-fg border-status-warehouse-border/40",
  transit: "bg-status-transit-bg text-status-transit-fg border-status-transit-border/40",
  delivered: "bg-status-delivered-bg text-status-delivered-fg border-status-delivered-border/40",
  pending: "bg-status-pending-bg text-status-pending-fg border-status-pending-border/40",
  danger: "bg-status-danger-bg text-status-danger-fg border-status-danger-border/40",
  success: "bg-status-success-bg text-status-success-fg border-status-success-border/40",
};

const DOT_CLASSES: Record<string, string> = {
  sourcing: "bg-status-sourcing-border",
  warehouse: "bg-status-warehouse-border",
  transit: "bg-status-transit-border",
  delivered: "bg-status-delivered-border",
  pending: "bg-status-pending-border",
  danger: "bg-status-danger-border",
  success: "bg-status-success-border",
};

function Dot({ palette }: { palette: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[palette])}
    />
  );
}

export function StatusPill({ status, isUnassigned, className, showDot = true }: StatusPillProps) {
  // "Unassigned" overrides the underlying status visually
  if (isUnassigned) {
    return (
      <span className={cn("pill border", PALETTE_CLASSES.danger, className)}>
        {showDot && <Dot palette="danger" />}
        Unassigned
      </span>
    );
  }
  const meta = STATUS_BY_CODE[status];
  if (!meta) {
    return (
      <span className={cn("pill border", PALETTE_CLASSES.pending, className)}>
        {showDot && <Dot palette="pending" />}
        {status}
      </span>
    );
  }
  return (
    <span className={cn("pill border", PALETTE_CLASSES[meta.palette], className)}>
      {showDot && <Dot palette={meta.palette} />}
      {meta.label}
    </span>
  );
}
