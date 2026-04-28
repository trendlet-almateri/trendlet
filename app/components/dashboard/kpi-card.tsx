import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  trend?: { direction: "up" | "down"; value: string };
  tone?: "default" | "danger" | "success" | "active";
  hero?: boolean;
  miniChart?: boolean;
};

const MINI_BARS = [3, 5, 4, 7, 6, 8, 9, 7, 10, 8, 11, 9, 12, 10];

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  tone = "default",
  hero = false,
  miniChart = false,
}: KpiCardProps) {
  const valueColor = cn(
    "mt-1 text-[28px] font-semibold leading-none tabular-nums tracking-tight",
    hero
      ? "text-white"
      : tone === "danger"
        ? "text-[#C05A00]"
        : tone === "success"
          ? "text-[#1A7F4B]"
          : tone === "active"
            ? "text-[#1D4ED8]"
            : "text-ink-primary",
  );

  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 overflow-hidden rounded-lg p-4",
        hero
          ? "bg-[#0C1F35] text-white"
          : "border border-hairline bg-surface",
      )}
    >
      {/* Label row */}
      <div className={cn(
        "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.6px]",
        hero ? "text-white/50" : tone === "danger" ? "text-[#C05A00]" : "text-ink-tertiary",
      )}>
        {Icon && <Icon className="h-3 w-3" aria-hidden />}
        <span>{label}</span>
      </div>

      {/* Value */}
      <span className={valueColor}>{value}</span>

      {/* Mini chart */}
      {miniChart && (
        <div className="flex items-end gap-[2px] h-7">
          {MINI_BARS.map((h, i) => (
            <span
              key={i}
              className={cn(
                "w-[3px] rounded-sm",
                hero ? "bg-white/30" : "bg-navy/20",
                i === MINI_BARS.length - 1 && (hero ? "bg-white/70" : "bg-navy/60"),
              )}
              style={{ height: `${(h / 12) * 100}%` }}
            />
          ))}
        </div>
      )}

      {/* Bottom row: trend + hint */}
      <div className={cn(
        "flex flex-wrap items-center gap-1.5 text-[11px]",
        hero ? "text-white/60" : "text-ink-secondary",
      )}>
        {trend && (
          <span className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            trend.direction === "up"
              ? "bg-[#DCFCE7] text-[#166534]"
              : "bg-[#FEE2E2] text-[#991B1B]",
            hero && trend.direction === "up" && "bg-white/15 text-white",
          )}>
            {trend.direction === "up"
              ? <TrendingUp className="h-2.5 w-2.5" aria-hidden />
              : <TrendingDown className="h-2.5 w-2.5" aria-hidden />
            }
            {trend.value}
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}
