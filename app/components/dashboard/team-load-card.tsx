import { cn } from "@/lib/utils";

type TeamLoadCardProps = {
  team: string;
  memberCount: number;
  activeCount: number;
  description: string;
  loadPercent: number;
  /** Tailwind bg class for top border + dot, e.g. 'bg-status-sourcing-border' */
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
    <div className="flex flex-col gap-2 rounded-md border border-hairline bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className={cn("h-1.5 w-1.5 rounded-full", accent)} aria-hidden />
        <span className="text-[12px] font-medium text-ink-primary">{team}</span>
      </div>
      <div className="text-[10px] uppercase tracking-[0.4px] text-ink-tertiary">
        {memberCount} {memberCount === 1 ? "member" : "members"}
      </div>
      <div className="text-[28px] font-medium leading-8 tabular-nums text-ink-primary">
        {activeCount.toLocaleString("en-US")}
      </div>
      <div className="text-[12px] text-ink-secondary">{description}</div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-100">
          <span className={cn("block h-full", accent)} style={{ width: `${safeLoad}%` }} />
        </div>
        <span className="text-[11px] tabular-nums text-ink-tertiary">{safeLoad}%</span>
      </div>
    </div>
  );
}
