import * as React from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /**
   * When true (default), the component grows to fill its flex parent and
   * centers its content vertically + horizontally — used at page level for
   * "no data" screens. Set false to render the old self-contained dashed
   * card; needed by in-table empty states where surrounding chrome (toolbar,
   * pagination footer) must stay attached below.
   */
  fill?: boolean;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  fill = true,
}: EmptyStateProps) {
  const card = (
    <div className="flex max-w-md flex-col items-center gap-4 text-center">
      {Icon ? (
        <span className="grid h-12 w-12 place-items-center rounded-full border border-[var(--line)] bg-[var(--hover)] sm:h-14 sm:w-14">
          <Icon className="h-5 w-5 text-[var(--muted)] sm:h-6 sm:w-6" aria-hidden />
        </span>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[14px] font-semibold text-[var(--ink)] sm:text-[15px]">
          {title}
        </h3>
        {description ? (
          <p className="text-[12.5px] leading-relaxed text-[var(--muted)] sm:text-[13px]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );

  // Card mode — the dashed bordered panel used inside tables/lists where the
  // surrounding chrome (e.g. pagination) must remain pinned below.
  if (!fill) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-dashed border-[var(--line)] bg-[var(--panel)] px-6 py-12 shadow-[var(--shadow-sm)]",
          className,
        )}
      >
        {card}
      </div>
    );
  }

  // Fill mode — grows to occupy the remaining flex space on the page and
  // centers the content. Requires the page root to be `flex flex-1 flex-col`
  // (set by app/(app)/layout.tsx and per-page wrappers).
  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-center px-4 py-12 sm:py-16",
        "min-h-[260px] sm:min-h-[320px] lg:min-h-[380px]",
        className,
      )}
    >
      {card}
    </div>
  );
}
