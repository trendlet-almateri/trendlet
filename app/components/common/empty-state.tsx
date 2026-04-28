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
        "flex flex-col items-center justify-center gap-2 rounded-md border border-hairline bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <Icon className="h-5 w-5 text-ink-tertiary" aria-hidden />
      )}
      <p className="text-[13px] font-medium text-ink-primary">{title}</p>
      {description && (
        <p className="max-w-md text-[12px] text-ink-secondary">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
