import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * SectionHeader — the one section title used across the app.
 *
 * Small uppercase muted label, optional leading icon, optional right-side
 * action (e.g. a "View all" link), and a trailing hairline divider that
 * fills the remaining width. Keeps every section's heading on one rhythm.
 *
 *   <SectionHeader label="Recent orders" icon={Package}
 *     action={<Link href="/orders">View all</Link>} />
 */
export function SectionHeader({
  label,
  icon: Icon,
  action,
  className,
}: {
  label: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex shrink-0 items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-[var(--muted-2)]" aria-hidden />}
        <h2 className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          {label}
        </h2>
      </div>
      <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
