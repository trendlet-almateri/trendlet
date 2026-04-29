import { cn } from "@/lib/utils";

type TeamLoadCardProps = {
  team: string;
  memberCount: number;
  activeCount: number;
  description: string;
  loadPercent: number;
  accent: string;
};

export function TeamLoadCard({
  team,
  memberCount,
  activeCount,
  description,
  loadPercent,
  accent,
}: TeamLoadCardProps) {
  const safeLoad = Math.max(0, Math.min(100, Math.round(loadPercent)));

  return (
    <div className="flex flex-col gap-2.5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
      {/* Team name + dot */}
      <div className="flex items-center gap-2">
        <span className={cn("h-1.5 w-1.5 rounded-full", accent)} aria-hidden />
        <span className="text-[12px] font-semibold text-[var(--ink)]">{team}</span>
      </div>

      {/* Member count */}
      <div className="text-[10px] uppercase tracking-[0.4px] text-[var(--muted)]">
        {memberCount} {memberCount === 1 ? "member" : "members"}
      </div>

      {/* Active count — JetBrains Mono */}
      <div
        className="font-[family-name:var(--font-jetbrains,_'JetBrains_Mono',_monospace)] text-[28px] font-semibold leading-8 text-[var(--ink)]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {activeCount.toLocaleString("en-US")}
      </div>

      <div className="text-[12px] text-[var(--muted-2)]">{description}</div>

      {/* Progress bar */}
      <div className="mt-0.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
          <span
            className={cn("block h-full rounded-full transition-all duration-500", accent)}
            style={{ width: `${safeLoad}%` }}
          />
        </div>
        <span
          className="w-8 text-right font-[family-name:var(--font-jetbrains,_'JetBrains_Mono',_monospace)] text-[11px] text-[var(--muted)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {safeLoad}%
        </span>
      </div>
    </div>
  );
}
