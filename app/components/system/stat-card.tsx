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
        "rise-in flex flex-col justify-between gap-2 rounded-[var(--radius)] border p-5",
        accent
          ? "border-transparent bg-[var(--accent)] text-white shadow-[var(--shadow-md)]"
          : "border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] shadow-[var(--shadow-sm),inset_0_1px_0_rgba(255,255,255,0.8)]",
        className,
      )}
    >
      <span
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.14em]",
          accent ? "text-white/70" : "text-[var(--muted)]",
        )}
      >
        {label}
      </span>
      <div
        className={cn(
          "text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums",
          accent ? "text-white" : "text-[var(--ink)]",
        )}
      >
        {value}
      </div>
      {(caption || trend) && (
        <div
          className={cn(
            "flex items-center gap-2 text-[12px]",
            accent ? "text-white/80" : "text-[var(--muted)]",
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
      ? "text-[var(--green)]"
      : direction === "down"
        ? "text-[var(--rose)]"
        : "text-[var(--muted)]";
  return (
    <span className={cn("inline-flex items-center gap-1 font-medium", tone)}>
      <span aria-hidden>{arrow}</span>
      {text}
    </span>
  );
}
