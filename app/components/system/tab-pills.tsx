import Link from "next/link";
import { cn } from "@/lib/utils";

export type Tab = {
  key: string;
  label: string;
  count?: number;
  /** CSS color class for the leading dot, e.g. "bg-amber-400". Optional. */
  dotColor?: string;
};

/**
 * Horizontal tab pill bar. Active pill gets a hairline-strong border
 * and a soft shadow; inactive pills are transparent and gain a hover.
 *
 * Each pill links via Next router so tab state lives in URL params.
 * Caller controls the href via `hrefFor` (typically a tiny closure
 * that calls buildQuery()).
 */
export function TabPills({
  tabs,
  activeKey,
  hrefFor,
  className,
}: {
  tabs: Tab[];
  activeKey: string;
  hrefFor: (key: string) => string;
  className?: string;
}) {
  return (
    <nav
      role="tablist"
      className={cn("flex flex-wrap items-center gap-2 text-[13px]", className)}
    >
      {tabs.map((t) => {
        const isActive = t.key === activeKey;
        return (
          <Link
            key={t.key}
            href={hrefFor(t.key)}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "inline-flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-1.5 text-[13px] font-medium transition-colors",
              isActive
                ? "border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] shadow-[var(--shadow-sm),inset_0_1px_0_rgba(255,255,255,0.8)]"
                : "border-transparent text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]",
            )}
          >
            {t.dotColor && (
              <span className={cn("h-1.5 w-1.5 rounded-full", t.dotColor)} aria-hidden />
            )}
            {t.label}
            {typeof t.count === "number" && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums",
                  isActive
                    ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "bg-[var(--hover)] text-[var(--muted)]",
                )}
              >
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
