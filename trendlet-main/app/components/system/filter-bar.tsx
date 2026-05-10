import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Filter bar shell. Renders a "Filters" icon-label, then the children
 * (typically a row of <FilterSelect>), and an optional right-side slot
 * (sort, export, etc.).
 *
 * The form posts back to `action` with `method=GET`, so filters become
 * URL params and the page re-renders server-side with the new state.
 */
export function FilterBar({
  action,
  hidden,
  children,
  right,
  className,
}: {
  action: string;
  /** Hidden inputs to preserve other URL state (e.g. active tab). */
  hidden?: Record<string, string>;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      method="GET"
      action={action}
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 text-[12px]",
        className,
      )}
    >
      {hidden &&
        Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 pr-1 text-[12px] text-ink-tertiary">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Filters
        </span>
        {children}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </form>
  );
}

/**
 * Native <select> styled to match the rest of the design system.
 * Renders a custom chevron via an absolutely-positioned SVG so the
 * native arrow is hidden but the keyboard/touch behavior is preserved.
 */
export function FilterSelect({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative inline-flex items-center">
      <select
        className={cn(
          "h-8 appearance-none rounded-md border border-hairline bg-surface pl-3 pr-7 text-[12px] text-ink-primary transition-colors hover:bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDownIcon />
    </span>
  );
}

/**
 * Primary "Apply" submit button styled to match the system. Use as
 * the right-side action of <FilterBar> when filters need a manual
 * apply (i.e. you don't auto-submit on change).
 */
export function FilterSubmit({ children = "Apply" }: { children?: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-navy-deep"
    >
      {children}
    </button>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      className="pointer-events-none absolute right-2 h-3 w-3 text-ink-tertiary"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
