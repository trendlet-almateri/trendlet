import { cn } from "@/lib/utils";

/**
 * Standard page heading. Always has the same scale (28px / -0.02em
 * tracking / 600 weight). Subtitle and right-side actions are optional.
 *
 * Usage:
 *   <PageHeader title="My sourcing tasks" subtitle="US brands · 12 active" />
 *   <PageHeader title="Invoices" subtitle="..." actions={<Button>New</Button>} />
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex h-20 flex-wrap items-center justify-between gap-3 md:h-auto md:items-end", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="truncate text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink-primary md:text-[28px]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] text-ink-tertiary">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
