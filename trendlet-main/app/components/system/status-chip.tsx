import { cn } from "@/lib/utils";

/**
 * One source of truth for status pill styling. Maps every status code
 * (and a few semantic aliases) to a fixed palette so the same chip
 * looks identical wherever it appears in the app.
 *
 * Stage mapping is locked to the screenshot spec — do not silently
 * remap codes here without checking with the design system owner.
 */
type StagePalette = {
  bg: string;
  fg: string;
  ring?: string;
};

const STAGE: Record<string, StagePalette> = {
  // Pre-purchase / neutral
  pending:    { bg: "bg-status-pending-bg",  fg: "text-status-pending-fg" },
  assigned:   { bg: "bg-status-pending-bg",  fg: "text-status-pending-fg" },
  unassigned: { bg: "bg-status-danger-bg",   fg: "text-status-danger-fg" },

  // Sourcing (amber)
  in_progress:        { bg: "bg-status-sourcing-bg", fg: "text-status-sourcing-fg" },
  under_review:       { bg: "bg-status-sourcing-bg", fg: "text-status-sourcing-fg" },
  purchased_online:   { bg: "bg-status-sourcing-bg", fg: "text-status-sourcing-fg" },
  purchased_in_store: { bg: "bg-status-sourcing-bg", fg: "text-status-sourcing-fg" },
  out_of_stock:       { bg: "bg-status-danger-bg",   fg: "text-status-danger-fg" },

  // Warehouse (blue / sky)
  delivered_to_warehouse: { bg: "bg-status-warehouse-bg", fg: "text-status-warehouse-fg" },
  preparing_for_shipment: { bg: "bg-status-warehouse-bg", fg: "text-status-warehouse-fg" },

  // Transit (violet)
  shipped:          { bg: "bg-status-transit-bg", fg: "text-status-transit-fg" },
  arrived_in_ksa:   { bg: "bg-status-transit-bg", fg: "text-status-transit-fg" },
  out_for_delivery: { bg: "bg-status-transit-bg", fg: "text-status-transit-fg" },

  // Terminal
  delivered: { bg: "bg-status-delivered-bg", fg: "text-status-delivered-fg" },
  returned:  { bg: "bg-status-danger-bg",    fg: "text-status-danger-fg" },
  cancelled: { bg: "bg-status-pending-bg",   fg: "text-status-pending-fg" },
  failed:    { bg: "bg-status-danger-bg",    fg: "text-status-danger-fg" },

  // Aliases for the screenshots (Dashboard / Orders shorthand labels)
  shipping:  { bg: "bg-status-warehouse-bg", fg: "text-status-warehouse-fg" },
  warehouse: { bg: "bg-status-transit-bg",   fg: "text-status-transit-fg" },
  delayed:   { bg: "bg-status-danger-bg",    fg: "text-status-danger-fg" },
};

const FALLBACK: StagePalette = STAGE.pending;

export type StatusKey = keyof typeof STAGE | (string & {});

export function StatusChip({
  status,
  label,
  size = "sm",
  className,
}: {
  status: StatusKey;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const palette = STAGE[status as keyof typeof STAGE] ?? FALLBACK;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]",
        palette.bg,
        palette.fg,
        className,
      )}
    >
      {label ?? humanize(status)}
    </span>
  );
}

function humanize(code: string): string {
  return code
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
