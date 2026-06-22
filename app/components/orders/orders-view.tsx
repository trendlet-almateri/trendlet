"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LayoutList, GitBranch, Search, SlidersHorizontal, Columns, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrdersTable } from "./orders-table";
import { OrdersPipeline } from "./orders-pipeline";
import { OrderDrawer } from "./order-drawer";
import {
  OrdersFilters,
  ActiveFiltersStrip,
  parseFilters,
  serializeFilters,
  UNASSIGNED_SENTINEL,
  type OrdersFilterState,
} from "./orders-filters";
import { FINAL_STATUSES, type OrderRow } from "@/lib/queries/orders";
import { regionLabel } from "@/lib/utils/region";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

type Props = {
  orders: OrderRow[];
  totalCount: number;
  brands: { name: string }[];
  assignees: { id: string; full_name: string }[];
};

export function OrdersView({ orders, totalCount, brands, assignees }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [view,     setView]     = React.useState<"table" | "pipeline">("table");
  const [page,     setPage]     = React.useState(1);
  const [pageSize, setPageSize] = React.useState<PageSize>(25);
  const [search,   setSearch]   = React.useState("");
  const [drawer,   setDrawer]   = React.useState<OrderRow | null>(null);

  // Filters: hydrate from URL on mount, push back to URL on change.
  // Initial state derived synchronously so SSR + first paint agree.
  const [filters, setFilters] = React.useState<OrdersFilterState>(() =>
    parseFilters(new URLSearchParams(searchParams?.toString() ?? "")),
  );

  React.useEffect(() => {
    const sp = serializeFilters(filters);
    // Preserve any unrelated query params (e.g. ?filter= legacy TabPill key).
    const existing = new URLSearchParams(searchParams?.toString() ?? "");
    // Drop filter keys we own so we don't double-emit.
    for (const k of ["status", "brand", "assignee", "region", "from", "to", "issues"]) {
      existing.delete(k);
    }
    for (const [k, v] of sp.entries()) existing.set(k, v);
    const qs = existing.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Quick lookup: assignee id → full_name for the active-chip labels.
  const assigneeNameById = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of assignees) m[a.id] = a.full_name;
    return m;
  }, [assignees]);

  // ── Search (textual) ─────────────────────────────────────────────────
  const searched = React.useMemo(() => {
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

  // ── Structured filters (combinable, AND across categories) ───────────
  const displayed = React.useMemo(() => {
    const f = filters;
    return searched.filter((o) => {
      // STATUS bucket (mirrors TabPill semantics)
      if (f.status === "active" && !o.sub_orders.some((s) => !FINAL_STATUSES.has(s.status))) return false;
      if (f.status === "delayed" && !o.sub_orders.some((s) => s.is_delayed)) return false;
      if (f.status === "completed" && !o.sub_orders.every((s) => FINAL_STATUSES.has(s.status))) return false;
      if (f.status === "unassigned" && !o.sub_orders.some((s) => s.is_unassigned)) return false;
      if (f.status === "cancelled" && !o.sub_orders.every((s) => s.status === "cancelled")) return false;

      // BRAND (OR within field, AND with other filters)
      if (f.brands.length && !o.sub_orders.some((s) => s.brand_name_raw && f.brands.includes(s.brand_name_raw))) {
        return false;
      }

      // ASSIGNEE
      if (f.assignees.length) {
        const wantUnassigned = f.assignees.includes(UNASSIGNED_SENTINEL);
        const ok = o.sub_orders.some(
          (s) =>
            (wantUnassigned && s.is_unassigned) ||
            (s.assigned_employee_id && f.assignees.includes(s.assigned_employee_id)),
        );
        if (!ok) return false;
      }

      // REGION (against customer's default_address.country)
      if (f.regions.length) {
        const country = o.customer?.default_address?.country;
        const label = regionLabel(country);
        const bucket =
          label === "KSA" || label === "US" || label === "EU" ? label : "Other";
        if (!f.regions.includes(bucket as (typeof f.regions)[number])) return false;
      }

      // DATE RANGE (inclusive, against shopify_created_at date portion)
      const created = o.shopify_created_at.slice(0, 10);
      if (f.dateFrom && created < f.dateFrom) return false;
      if (f.dateTo && created > f.dateTo) return false;

      // ISSUES ONLY
      if (f.issuesOnly && !o.sub_orders.some((s) => s.is_delayed || s.is_unassigned)) return false;

      return true;
    });
  }, [searched, filters]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(displayed.length / pageSize));
  const safePagecurrent = Math.min(page, totalPages);
  const sliceStart = (safePagecurrent - 1) * pageSize;
  const sliceEnd   = sliceStart + pageSize;
  const pageItems  = displayed.slice(sliceStart, sliceEnd);

  // Reset page when filter/search/page-size changes
  React.useEffect(() => { setPage(1); }, [search, filters, pageSize]);

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
    <div className="flex flex-col gap-4">
      {/* Top bar: search + chips + toggle + sort/columns — all 32px tall */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-[var(--muted)]" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders…"
            className="h-8 min-w-[220px] lg:min-w-[280px] rounded-md border border-[var(--line)] bg-[var(--panel)] pl-8 pr-10 text-[12px] text-[var(--ink)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--accent)] focus:outline-none"
          />
          <kbd className="absolute right-2 rounded border border-[var(--line)] px-1 py-px font-[family-name:var(--font-jetbrains,_monospace)] text-[9px] text-[var(--muted)]">
            ⌘K
          </kbd>
        </div>

        {/* Filters popover (consolidates the 6 dimensions previously shown as chips) */}
        <OrdersFilters
          value={filters}
          onChange={setFilters}
          brands={brands}
          assignees={assignees}
        />

        {/* Spacer */}
        <div className="ml-auto flex items-center gap-2">
          {/* Sort */}
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 text-[12px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            Priority
          </button>

          {/* Columns */}
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 text-[12px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--ink)]"
          >
            <Columns className="h-3.5 w-3.5" aria-hidden />
            Columns
          </button>

          {/* View toggle — outer p-0.5 + inner h-7 = 32px total to match the row */}
          <div className="flex h-8 items-center rounded-lg border border-[var(--line)] bg-[var(--panel)] p-0.5">
            <button
              type="button"
              onClick={() => setView("table")}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium transition-colors",
                view === "table"
                  ? "bg-[var(--ink)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--ink)]",
              )}
            >
              <LayoutList className="h-3.5 w-3.5" aria-hidden />
              Table
            </button>
            <button
              type="button"
              onClick={() => setView("pipeline")}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium transition-colors",
                view === "pipeline"
                  ? "bg-[var(--ink)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--ink)]",
              )}
            >
              <GitBranch className="h-3.5 w-3.5" aria-hidden />
              Pipeline
            </button>
          </div>
        </div>
      </div>

      {/* Active filter chips under the toolbar (hidden when no filters active) */}
      <ActiveFiltersStrip
        value={filters}
        onChange={setFilters}
        assigneeNameById={assigneeNameById}
      />

      {/* View */}
      {view === "table" ? (
        <>
          <OrdersTable orders={pageItems} onOpenDrawer={setDrawer} />

          {/* Pagination footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
            <div className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-jetbrains,_monospace)] text-[11px] tabular-nums text-[var(--muted)]">
                {displayed.length === 0
                  ? "No orders"
                  : `Showing ${sliceStart + 1}–${Math.min(sliceEnd, displayed.length)} of ${displayed.length} orders`}
              </span>
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                Rows
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
                  className="h-7 rounded-md border border-[var(--line)] bg-[var(--panel)] px-1.5 text-[11px] tabular-nums text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                  aria-label="Rows per page"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>

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
