"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type TabKey = "todo" | "in_progress" | "completed";

type Props = {
  brands: { id: string; name: string }[];
  activeTab: TabKey;
  brandFilter: string;
  sortKey: string;
  isAdmin: boolean;
};

const chipBase =
  "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] px-3 text-[12px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]";
const chipActive = "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]";

export function SourcingFilterBar({ brands, activeTab, brandFilter, sortKey, isAdmin }: Props) {
  return (
    <form method="GET" action="/queue" className="flex flex-wrap items-center justify-between gap-3">
      <input type="hidden" name="tab" value={activeTab} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </span>

        {/* Priority — coming soon */}
        <span className={cn(chipBase, "cursor-not-allowed opacity-50")} title="Coming soon">
          + Priority
        </span>

        {/* Region */}
        <span className={cn(chipBase, "cursor-not-allowed opacity-50")} title="Locked to US for sourcing">
          + Region
        </span>

        {/* Brand */}
        <div className="relative">
          <select
            name="brand"
            defaultValue={brandFilter}
            className={cn(
              chipBase,
              "appearance-none cursor-pointer pr-6",
              brandFilter !== "all" && chipActive,
            )}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          >
            <option value="all">+ Brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <Chevron />
        </div>

        {/* Agent — admin only */}
        {isAdmin && (
          <span className={cn(chipBase, "cursor-not-allowed opacity-50")} title="Agent filter coming soon">
            + Agent
          </span>
        )}
      </div>

      {/* Sort */}
      <div className="relative">
        <select
          name="sort"
          defaultValue={sortKey}
          className="h-8 appearance-none rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] pl-3 pr-7 text-[12px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--hover)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          <option value="urgent">Sort: Urgent first</option>
          <option value="newest">Sort: Newest first</option>
          <option value="oldest">Sort: Oldest first</option>
        </select>
        <Chevron />
      </div>
    </form>
  );
}

function Chevron() {
  return (
    <svg
      className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--muted)]"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
