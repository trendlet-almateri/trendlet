import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  trend?: { direction: "up" | "down"; value: string };
  tone?: "default" | "danger";
  hero?: boolean;
};

/**
 * Standard KPI tile. Set `hero` for the navy "Gross processed" card.
 */
export function KpiCard({ label, value, hint, trend, tone = "default", hero = false }: KpiCardProps) {
  const isHero = hero;
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-md p-4",
        isHero
          ? "bg-navy-deep text-white"
          : "border border-hairline bg-surface text-ink-primary",
      )}
    >
      <span
        className={cn(
          "text-hint uppercase",
          isHero ? "text-white/60" : "text-ink-tertiary",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "mt-0.5 text-[24px] font-medium leading-7 tabular-nums",
          tone === "danger" && !isHero && "text-[#791F1F]",
        )}
      >
        {value}
      </span>
      <div
        className={cn(
          "mt-0.5 flex items-center gap-1.5 text-[11px]",
          isHero ? "text-white/70" : "text-ink-secondary",
        )}
      >
        {trend && (
          <span className="inline-flex items-center gap-0.5">
            {trend.direction === "up" ? (
              <TrendingUp className="h-3 w-3" aria-hidden />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden />
            )}
            {trend.value}
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}
