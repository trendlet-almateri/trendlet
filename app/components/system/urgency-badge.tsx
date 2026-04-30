import { cn } from "@/lib/utils";

/**
 * URGENT / NORMAL pill. Red-tinted when urgent, neutral gray when
 * normal. Uppercase 10px, semibold, wide letter-spacing for the
 * "label-style" feel from the spec.
 */
export function UrgencyBadge({
  urgent,
  className,
}: {
  urgent: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.6px]",
        urgent
          ? "bg-status-danger-bg text-status-danger-fg"
          : "bg-neutral-100 text-ink-tertiary",
        className,
      )}
    >
      {urgent ? "Urgent" : "Normal"}
    </span>
  );
}
