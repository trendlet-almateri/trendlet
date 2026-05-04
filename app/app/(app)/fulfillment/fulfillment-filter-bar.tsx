"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const selectClass =
  "h-8 appearance-none rounded-md border border-[var(--line)] bg-[var(--panel)] pl-3 pr-7 text-[12px] text-ink-primary transition-colors hover:bg-[var(--hover)] focus:outline-none focus:ring-1 focus:ring-accent/40";

export function FulfillmentFilterBar({
  brands,
  activeTab,
  brandFilter,
  sortKey,
}: {
  brands: { id: string; name: string }[];
  activeTab: string;
  brandFilter: string;
  sortKey: string;
}) {
  return (
    <form
      method="GET"
      action="/fulfillment"
      className="flex flex-wrap items-center justify-between gap-3 text-[12px]"
    >
      <input type="hidden" name="tab" value={activeTab} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 pr-1 text-[12px] text-[var(--muted)]">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Filters
        </span>
        <SelectField name="priority" defaultValue="all" disabled title="Priority filter — coming soon" aria-label="Filter by priority">
          <option value="all">All priorities</option>
        </SelectField>
        <SelectField name="region" defaultValue="all" disabled title="Region filter — fulfillment is locked to EU" aria-label="Filter by region">
          <option value="all">All regions</option>
        </SelectField>
        <SelectField name="brand" defaultValue={brandFilter} aria-label="Filter by brand" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
          <option value="all">All brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </SelectField>
      </div>
      <SelectField name="sort" defaultValue={sortKey} aria-label="Sort by" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        <option value="newest">Sort: Newest first</option>
        <option value="oldest">Sort: Oldest first</option>
      </SelectField>
    </form>
  );
}

function SelectField({ children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative inline-flex items-center">
      <select className={cn(selectClass, rest.disabled && "cursor-not-allowed opacity-50")} {...rest}>
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2 h-3 w-3 text-ink-tertiary"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden
      >
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
