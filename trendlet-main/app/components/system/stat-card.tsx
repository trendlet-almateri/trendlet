import { cn } from "@/lib/utils";

/**
 * Big-number tile, e.g. on Dashboard ("TOTAL ORDERS / 1,284 / ↑ 8.2%")
 * and Invoices ("AWAITING / 8"). Two variants:
 *
 *   default  — white surface, hairline border (used for most tiles).
 *   accent   — navy background, white ink (used for the highlight tile,
 *              e.g. "GROSS PROCESSED" or "PENDING VALUE").
 */
export function StatCard({
  label,
  value,
  caption,
  trend,
  variant = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  trend?: { direction: "up" | "down" | "flat"; text: string };
  variant?: "default" | "accent";
  className?: string;
}) {
  const accent = variant === "accent";
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-2 rounded-lg border p-5",
        accent
          ? "border-transparent bg-accent text-white shadow-sm"
          : "border-hairline bg-surface text-ink-primary shadow-sm",
        className,
      )}
    >
      <span
        className={cn(
          "text-[10px] font-medium uppercase tracking-[0.6px]",
          accent ? "text-white/70" : "text-ink-tertiary",
        )}
      >
        {label}
      </span>
      <div
        className={cn(
          "text-[32px] font-semibold leading-none tracking-[-0.02em] tabular-nums",
          accent ? "text-white" : "text-ink-primary",
        )}
      >
        {value}
      </div>
      {(caption || trend) && (
        <div
          className={cn(
            "flex items-center gap-2 text-[12px]",
            accent ? "text-white/80" : "text-ink-tertiary",
          )}
        >
          {trend && <Trend direction={trend.direction} text={trend.text} accent={accent} />}
          {caption && <span>{caption}</span>}
        </div>
      )}
    </div>
  );
}

function Trend({
  direction,
  text,
  accent,
}: {
  direction: "up" | "down" | "flat";
  text: string;
  accent: boolean;
}) {
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  const tone = accent
    ? "text-white"
    : direction === "up"
      ? "text-emerald-700"
      : direction === "down"
        ? "text-rose-600"
        : "text-ink-tertiary";
  return (
    <span className={cn("inline-flex items-center gap-1 font-medium", tone)}>
      <span aria-hidden>{arrow}</span>
      {text}
    </span>
  );
}
