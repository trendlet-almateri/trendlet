import * as React from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-dashed border-[var(--line)] bg-[var(--panel)] px-6 py-14 text-center shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      {Icon && (
        <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] bg-[var(--hover)]">
          <Icon className="h-5 w-5 text-[var(--muted)]" aria-hidden />
        </span>
      )}
      <p className="text-[13px] font-medium text-[var(--ink)]">{title}</p>
      {description && (
        <p className="max-w-md text-[12px] text-[var(--muted)]">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
