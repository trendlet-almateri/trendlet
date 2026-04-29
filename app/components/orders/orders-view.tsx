"use client";

import * as React from "react";
import { LayoutList, GitBranch, Search, SlidersHorizontal, Columns, ChevronLeft, ChevronRight, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrdersTable } from "./orders-table";
import { OrdersPipeline } from "./orders-pipeline";
import { OrderDrawer } from "./order-drawer";
import type { OrderRow } from "@/lib/queries/orders";

const PAGE_SIZE = 12;

type Props = {
  orders: OrderRow[];
  totalCount: number;
};

type FilterChip = {
  id: string;
  label: string;
  active: boolean;
  rose?: boolean;
};

const INITIAL_CHIPS: FilterChip[] = [
  { id: "status",    label: "Status",     active: false },
  { id: "brand",     label: "Brand",      active: false },
  { id: "assignee",  label: "Assignee",   active: false },
  { id: "region",    label: "Region",     active: false },
  { id: "date",      label: "Date range", active: false },
  { id: "issues",    label: "Issues only", active: false, rose: true },
];

export function OrdersView({ orders, totalCount }: Props) {
  const [view,    setView]    = React.useState<"table" | "pipeline">("table");
  const [page,    setPage]    = React.useState(1);
  const [search,  setSearch]  = React.useState("");
  const [chips,   setChips]   = React.useState(INITIAL_CHIPS);
  const [drawer,  setDrawer]  = React.useState<OrderRow | null>(null);

  // Filter by search
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const customer = o.customer
        ? [o.customer.first_name, o.customer.last_name].filter(Boolean).join(" ")
        : "";
      return (
        o.shopify_order_number.toLowerCase().includes(q) ||
        customer.toLowerCase().includes(q) ||
        o.sub_orders.some((s) => s.brand_name_raw?.toLowerCase().includes(q))
      );
    });
  }, [orders, search]);

  // "Issues only" chip filter
  const issueChip = chips.find((c) => c.id === "issues");
  const displayed = React.useMemo(() => {
    if (!issueChip?.active) return filtered;
    return filtered.filter((o) =>
      o.sub_orders.some((s) => s.is_delayed || s.is_unassigned),
    );
  }, [filtered, issueChip?.active]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE));
  const safePagecurrent = Math.min(page, totalPages);
  const sliceStart = (safePagecurrent - 1) * PAGE_SIZE;
  const sliceEnd   = sliceStart + PAGE_SIZE;
  const pageItems  = displayed.slice(sliceStart, sliceEnd);

  // Reset page when filter/search changes
  React.useEffect(() => { setPage(1); }, [search, chips]);

  function toggleChip(id: string) {
    setChips((prev) =>
      prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c)),
    );
  }

  function renderPageButtons() {
    const pages: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePagecurrent > 3) pages.push("…");
      for (let i = Math.max(2, safePagecurrent - 1); i <= Math.min(totalPages - 1, safePagecurrent + 1); i++) {
        pages.push(i);
      }
      if (safePagecurrent < totalPages - 2) pages.push("…");
      pages.push(totalPages);
    }
    return pages;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Top bar: search + chips + toggle + sort/columns */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-[var(--muted)]" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders…"
            className="h-8 rounded-md border border-[var(--line)] bg-[var(--panel)] pl-8 pr-10 text-[12px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
          />
          <kbd className="absolute right-2 rounded border border-[var(--line)] px-1 py-px font-[family-name:var(--font-jetbrains,_monospace)] text-[9px] text-[var(--muted)]">
            ⌘K
          </kbd>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => toggleChip(chip.id)}
              className={cn(
                "flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium transition-colors",
                chip.active
                  ? chip.rose
                    ? "border border-[var(--rose)]/40 bg-[var(--rose-bg)] text-[var(--rose)]"
                    : "border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]"
                  : chip.rose
                    ? "border border-dashed border-[var(--rose)]/50 text-[var(--rose)]/70 hover:border-[var(--rose)]"
                    : "border border-dashed border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)]",
              )}
            >
              {chip.active ? (
                <X className="h-2.5 w-2.5" aria-hidden />
              ) : (
                <Plus className="h-2.5 w-2.5" aria-hidden />
              )}
              {chip.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="ml-auto flex items-center gap-1.5">
          {/* Sort */}
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2.5 text-[11px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"
          >
            <SlidersHorizontal className="h-3 w-3" aria-hidden />
            Priority
          </button>

          {/* Columns */}
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2.5 text-[11px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"
          >
            <Columns className="h-3 w-3" aria-hidden />
            Columns
          </button>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-[var(--line)] bg-[var(--panel)] p-0.5">
            <button
              type="button"
              onClick={() => setView("table")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                view === "table"
                  ? "bg-[var(--ink)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--ink)]",
              )}
            >
              <LayoutList className="h-3 w-3" aria-hidden />
              Table
            </button>
            <button
              type="button"
              onClick={() => setView("pipeline")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                view === "pipeline"
                  ? "bg-[var(--ink)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--ink)]",
              )}
            >
              <GitBranch className="h-3 w-3" aria-hidden />
              Pipeline
            </button>
          </div>
        </div>
      </div>

      {/* View */}
      {view === "table" ? (
        <>
          <OrdersTable orders={pageItems} onOpenDrawer={setDrawer} />

          {/* Pagination footer */}
          <div className="flex items-center justify-between py-1">
            <span className="font-[family-name:var(--font-jetbrains,_monospace)] text-[11px] tabular-nums text-[var(--muted)]">
              {displayed.length === 0
                ? "No orders"
                : `Showing ${sliceStart + 1}–${Math.min(sliceEnd, displayed.length)} of ${displayed.length} orders`}
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                {/* Prev */}
                <button
                  type="button"
                  disabled={safePagecurrent === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                </button>

                {/* Page numbers */}
                {renderPageButtons().map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-[12px] text-[var(--muted)]">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md border font-[family-name:var(--font-jetbrains,_monospace)] text-[12px] tabular-nums transition-colors",
                        p === safePagecurrent
                          ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                          : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)]",
                      )}
                      aria-current={p === safePagecurrent ? "page" : undefined}
                    >
                      {p}
                    </button>
                  ),
                )}

                {/* Next */}
                <button
                  type="button"
                  disabled={safePagecurrent === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <OrdersPipeline orders={displayed} />
      )}

      {/* Detail drawer */}
      <OrderDrawer order={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
