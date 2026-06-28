import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

type TeamLoadCardProps = {
  team: string;
  memberCount: number;
  activeCount: number;
  description: string;
  loadPercent: number;
  accent: string;
  /** Stagger index for entrance — pass 0..N from parent */
  index?: number;
};

export function TeamLoadCard({
  team,
  memberCount,
  activeCount,
  description,
  loadPercent,
  accent,
  index = 0,
}: TeamLoadCardProps) {
  const safeLoad = Math.max(0, Math.min(100, Math.round(loadPercent)));
  const isLive = activeCount > 0;

  return (
    <div
      className="rise-in flex h-full flex-col gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]"
      style={{ ["--stagger-index" as string]: String(index) }}
    >
      {/* Header — team name (left), member count in a subtle badge (right) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn("h-1.5 w-1.5 rounded-full", accent, isLive && "dot-breathe")}
            aria-hidden
          />
          <span className="truncate text-[12px] font-semibold text-[var(--ink)]">{team}</span>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--hover)] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--muted)]"
          title={`${memberCount} ${memberCount === 1 ? "member" : "members"}`}
        >
          <Users className="h-2.5 w-2.5" aria-hidden />
          {memberCount}
        </span>
      </div>

      {/* Metric — workload number centred, description directly beneath */}
      <div className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1">
        <span
          className={cn(
            "font-[family-name:var(--font-jetbrains,_'JetBrains_Mono',_monospace)] text-[32px] font-semibold leading-none text-[var(--ink)]",
            isLive && "value-tick",
          )}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {activeCount.toLocaleString("en-US")}
        </span>
        <span className="text-[11px] text-[var(--muted-2)]">{description}</span>
      </div>

      {/* Progress — bar pulled under the metric, % aligned on its baseline */}
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--line-2)]">
          <span
            className={cn("bar-fill block h-full rounded-full", accent)}
            style={{ width: `${safeLoad}%` }}
          />
        </div>
        <span
          className="w-8 text-right font-[family-name:var(--font-jetbrains,_'JetBrains_Mono',_monospace)] text-[11px] font-medium text-[var(--muted)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {safeLoad}%
        </span>
      </div>
    </div>
  );
}
