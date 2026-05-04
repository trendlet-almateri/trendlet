"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownSelect, type SelectOption } from "@/components/ui/dropdown-select";

export function FilterBar({
  action,
  hidden,
  children,
  right,
  className,
}: {
  action: string;
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
        <span className="inline-flex items-center gap-1.5 pr-1 text-[12px] text-[var(--muted)]">
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
 * A Radix-powered select inside a FilterBar form. Renders a hidden input
 * so the form's GET submission still includes the value.
 */
export function FilterSelect({
  name,
  defaultValue = "",
  options,
  className,
}: {
  name: string;
  defaultValue?: string;
  options: SelectOption[];
  className?: string;
}) {
  const [value, setValue] = React.useState(defaultValue);

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <DropdownSelect
        value={value}
        onChange={setValue}
        options={options}
        triggerClassName={className}
      />
    </>
  );
}

export function FilterSubmit({ children = "Apply" }: { children?: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="inline-flex h-8 items-center rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 text-[12px] font-medium text-white shadow-[var(--shadow-sm)] transition-colors hover:opacity-90"
    >
      {children}
    </button>
  );
}
