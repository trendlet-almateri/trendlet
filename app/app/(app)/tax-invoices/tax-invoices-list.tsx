"use client";

/**
 * Client-side filter/search shell for the Tax Invoices list.
 * Server fetches + sorts (newest first); this component handles UI affordances:
 * status quick filters, free-text search, hover/elevation, status colors.
 */

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Receipt, Search } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/lib/utils/currency";
import { relativeTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

export type TaxInvoiceStatus = "draft" | "issued" | "needs_pricing";

export type TaxInvoiceRow = {
  id: string;
  invoice_number: string;
  status: TaxInvoiceStatus;
  brand_name: string | null;
  category_ar: string | null;
  total_fee: number;
  currency: string;
  created_at: string;
  generated_at: string | null;
  order: { shopify_order_number: string | null } | null;
};

// ── Status visuals ──────────────────────────────────────────────────────────
// Stripe/Linear-style: soft tinted bg, subtle border, semantic ink, leading dot.
const STATUS_STYLE: Record<TaxInvoiceStatus, { cls: string; dot: string; label: string }> = {
  issued: {
    cls: "bg-status-delivered-bg text-status-delivered-fg border-status-delivered-border/40",
    dot: "bg-status-delivered-border",
    label: "Issued",
  },
  needs_pricing: {
    cls: "bg-status-sourcing-bg text-status-sourcing-fg border-status-sourcing-border/40",
    dot: "bg-status-sourcing-border",
    label: "Pending Pricing",
  },
  draft: {
    cls: "bg-status-pending-bg text-status-pending-fg border-status-pending-border/40",
    dot: "bg-status-pending-border",
    label: "Draft",
  },
};

// Failed isn't a current DB status, but the spec asks for it in the filter row
// so it's visible/forward-compatible without a schema change.
type FilterKey = "all" | "issued" | "needs_pricing" | "failed";

const FILTERS: { key: FilterKey; label: string; match: (r: TaxInvoiceRow) => boolean }[] = [
  { key: "all",           label: "All",             match: () => true },
  { key: "issued",        label: "Issued",          match: (r) => r.status === "issued" },
  { key: "needs_pricing", label: "Pending Pricing", match: (r) => r.status === "needs_pricing" },
  { key: "failed",        label: "Failed",          match: () => false },
];

export function TaxInvoicesList({ invoices }: { invoices: TaxInvoiceRow[] }) {
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [query, setQuery] = React.useState("");

  const counts = React.useMemo(() => {
    const c: Record<FilterKey, number> = { all: invoices.length, issued: 0, needs_pricing: 0, failed: 0 };
    for (const inv of invoices) {
      if (inv.status === "issued") c.issued++;
      else if (inv.status === "needs_pricing") c.needs_pricing++;
    }
    return c;
  }, [invoices]);

  const filtered = React.useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (!f.match(inv)) return false;
      if (!q) return true;
      const hay = [
        inv.invoice_number,
        inv.order?.shopify_order_number ?? "",
        inv.brand_name ?? "",
        inv.category_ar ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [invoices, filter, query]);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Filter row + search ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const n = counts[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] font-medium transition-colors",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--line)] bg-[var(--panel)] text-[var(--ink-2)] hover:bg-[var(--hover)]",
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "mono inline-flex h-[18px] min-w-[18px] items-center justify-center rounded px-1 text-[10px] tabular-nums",
                    active
                      ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "bg-[var(--hover)] text-[var(--muted)]",
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[var(--muted-2)]" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search invoice, order, brand…"
            aria-label="Search tax invoices"
            className="h-8 w-[260px] rounded-md border border-[var(--line)] bg-[var(--panel)] pl-8 pr-3 text-[12px] text-[var(--ink)] placeholder:text-[var(--muted-2)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
          />
        </div>
      </div>

      {/* ── Cards ──────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={query || filter !== "all" ? "No invoices match" : "No tax invoices yet"}
          description={
            query || filter !== "all"
              ? "Try a different filter or clear the search."
              : "Create a tax invoice from an order — fees are looked up from the pricing table by brand and category."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((inv, i) => {
            const s = STATUS_STYLE[inv.status];
            const ts = inv.generated_at ?? inv.created_at;
            return (
              <li key={inv.id}>
                <Link
                  href={`/tax-invoices/${inv.id}`}
                  className={cn(
                    "rise-in group grid grid-cols-[1fr_auto] items-center gap-5 rounded-[10px]",
                    "border border-[var(--line)] bg-[var(--panel)] px-5 py-4",
                    "shadow-[0_1px_2px_rgba(15,20,25,0.04)] transition-all duration-150",
                    "hover:-translate-y-[1px] hover:border-[var(--line-2)] hover:bg-[var(--hover)]",
                    "hover:shadow-[0_4px_14px_-6px_rgba(15,20,25,0.12)]",
                    "active:translate-y-0 active:shadow-[0_1px_2px_rgba(15,20,25,0.04)]",
                  )}
                  style={{ ["--stagger-index" as string]: String(Math.min(i, 12)) }}
                >
                  {/* ── Left: hierarchy ───────────────────────────────── */}
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mono text-[14px] font-semibold leading-none tracking-tight text-[var(--ink)]">
                        {inv.invoice_number}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-2 py-[3px] text-[11px] font-medium leading-none",
                          s.cls,
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden />
                        {s.label}
                      </span>
                    </div>

                    {/* Secondary: order · brand · category — softer ink */}
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-[var(--ink-2)]">
                      {inv.order?.shopify_order_number ? (
                        <span className="text-[var(--muted)]">
                          Order <span className="mono text-[var(--ink-2)]">{inv.order.shopify_order_number}</span>
                        </span>
                      ) : null}
                      {inv.brand_name ? (
                        <>
                          <Dot />
                          <span className="truncate font-medium text-[var(--ink-2)]">{inv.brand_name}</span>
                        </>
                      ) : null}
                      {inv.category_ar ? (
                        <>
                          <Dot />
                          <span dir="rtl" className="truncate text-[var(--muted)]">
                            {inv.category_ar}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* ── Right: amount + time + chevron ────────────────── */}
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end gap-1">
                      <span className="mono text-[15px] font-semibold leading-none tabular-nums tracking-tight text-[var(--ink)]">
                        {formatCurrency(inv.total_fee, inv.currency)}
                      </span>
                      <span className="text-[11px] leading-none text-[var(--muted)]">
                        {relativeTime(ts)}
                      </span>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 text-[var(--muted-2)] transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--ink-2)]"
                      aria-hidden
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Dot() {
  return <span aria-hidden className="text-[var(--muted-2)]">·</span>;
}
