import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  trend?: { direction: "up" | "down"; value: string };
  /** default = neutral cream; active = blue; danger = rose; success = green; warn = amber gradient; hero = dark rev card */
  tone?: "default" | "danger" | "success" | "active" | "warn" | "hero";
  /** @deprecated — use tone="hero" */
  hero?: boolean;
  miniChart?: boolean;
  /** Stagger index for entrance — pass 0..N from parent so cards cascade in */
  index?: number;
};

const MINI_BARS = [3, 5, 4, 7, 6, 8, 9, 7, 10, 8, 11, 9, 12, 10];

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  tone: toneProp = "default",
  hero = false,
  miniChart = false,
  index = 0,
}: KpiCardProps) {
  const tone = hero ? "hero" : toneProp;

  const isHero = tone === "hero";
  const isWarn = tone === "warn";

  const cardCls = cn(
    "rise-in lift relative flex flex-col gap-2 overflow-hidden rounded-[var(--radius)] p-4",
    isHero && "bg-[linear-gradient(145deg,#0d1520_0%,#0f1d2e_50%,#152438_100%)] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_4px_16px_rgba(0,0,0,0.3)]",
    isWarn && "border border-[var(--amber)]/50 [background:linear-gradient(180deg,#fff9f0_0%,#ffffff_70%)] shadow-[var(--shadow-sm)]",
    !isHero && !isWarn && "border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm),inset_0_1px_0_rgba(255,255,255,0.8)]",
  );

  const labelCls = cn(
    "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.5px]",
    isHero ? "text-white/50"
    : isWarn ? "text-[var(--amber)]"
    : tone === "danger" ? "text-[var(--rose)]"
    : "text-[var(--muted)]",
  );

  const valueCls = cn(
    "value-tick mt-1 font-[family-name:var(--font-jetbrains,_'JetBrains_Mono',_monospace)] text-[28px] font-semibold leading-none tracking-[-0.03em]",
    "[font-variant-numeric:tabular-nums]",
    isHero ? "text-white"
    : tone === "danger" ? "text-[var(--rose)]"
    : tone === "success" ? "text-[var(--green)]"
    : tone === "active" ? "text-[var(--blue)]"
    : isWarn ? "text-[var(--amber)]"
    : "text-[var(--ink)]",
  );

  const bottomCls = cn(
    "flex flex-wrap items-center gap-1.5 text-[11px]",
    isHero ? "text-white/60"
    : isWarn ? "text-[var(--amber)]/80"
    : "text-[var(--muted)]",
  );

  return (
    <div
      className={cardCls}
      style={{ ["--stagger-index" as string]: String(index) }}
    >
      <div className={labelCls}>
        {Icon && <Icon className="h-3 w-3" aria-hidden />}
        <span>{label}</span>
      </div>

      <span className={valueCls}>{value}</span>

      {miniChart && (
        <div className="spark-wave flex h-7 items-end gap-[2px]">
          {MINI_BARS.map((h, i) => (
            <span
              key={i}
              className={cn(
                "spark-bar w-[3px] rounded-sm",
                isHero ? "bg-white/30" : "bg-[var(--accent)]/20",
                i === MINI_BARS.length - 1 && (isHero ? "bg-white/70" : "bg-[var(--accent)]/60"),
              )}
              style={{
                height: `${(h / 12) * 100}%`,
                "--i": String(i),
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      <div className={bottomCls}>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              trend.direction === "up"
                ? isHero
                  ? "bg-white/15 text-white"
                  : "bg-[var(--green-bg)] text-[var(--green)]"
                : "bg-[var(--rose-bg)] text-[var(--rose)]",
            )}
          >
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
