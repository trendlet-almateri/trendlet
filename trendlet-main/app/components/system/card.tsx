import { cn } from "@/lib/utils";

/**
 * Card shell — the "sourcing card" pattern from the spec. White
 * surface, hairline border, hover lift (subtle navy glow + accent
 * border), rounded-lg. Use as the outermost wrapper for any item
 * card (sourcing task, brand row, deliverable, etc.).
 *
 * Pass `accent="danger"` to highlight delayed / blocked items with
 * a left border. Pass `interactive` to enable the hover state.
 */
export function Card({
  children,
  accent,
  interactive = false,
  className,
  ...rest
}: {
  children: React.ReactNode;
  accent?: "danger" | "warning";
  interactive?: boolean;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-hairline bg-surface p-5 transition-all",
        interactive && "hover:border-accent/30 hover:shadow-[0_0_0_3px_rgba(12,68,124,0.06)]",
        accent === "danger" && "border-status-danger-border/40",
        accent === "warning" && "border-status-sourcing-border/40",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
