"use client";

import { Search } from "lucide-react";

/**
 * Click target that opens the command palette via custom event.
 * Keeping this a tiny client island lets the surrounding utility bar stay RSC.
 */
export function SearchTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("optify:open-palette"))}
      className="flex h-9 w-[280px] items-center gap-2 rounded-md border border-hairline bg-surface px-3 text-[13px] text-ink-tertiary transition-colors hover:border-hairline-strong"
      aria-label="Search"
    >
      <Search className="h-3.5 w-3.5" aria-hidden />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="rounded-sm bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-tertiary">
        ⌘K
      </kbd>
    </button>
  );
}
