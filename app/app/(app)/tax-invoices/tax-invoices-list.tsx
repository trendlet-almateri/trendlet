"use client";

/**
 * Tax Invoices — responsive grid of premium cards with toolbar (search + filters)
 * and a 4-up stats strip. Newest-first ordering happens server-side.
 */

import * as React from "react";
import Link from "next/link";
import {
  ChevronRight,
  Hash,
  Receipt,
  RefreshCw,
  Search,
  Store,
  Tag,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/lib/utils/currency";
import { relativeTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { regenerateAllTaxInvoicesAction } from "./actions";

export type TaxInvoiceStatus = "draft" | "issued" | "needs_pricing";

export type TaxInvoiceRow = {
  id: string;
  invoice_number: string;
  status: TaxInvoiceStatus;
  total_fee: number;
  currency: string;
  created_at: string;
  generated_at: string | null;
  order: {
    shopify_order_number: string | null;
    customer: { first_name: string | null; last_name: string | null } | null;
    sub_orders: { brand: { name: string | null } | null }[] | null;
  } | null;
};

// ── Status visuals — semantic, restrained ─────────────────────────────────
const STATUS_STYLE: Record<TaxInvoiceStatus, { cls: string; dot: string; label: string }> = {
  issued: {
    cls: "bg-[var(--green-bg)] text-[var(--green)] border-[var(--green)]/25",
    dot: "bg-[var(--green)]",
    label: "Issued",
  },
  needs_pricing: {
    cls: "bg-[var(--amber-bg)] text-[var(--amber)] border-[var(--amber)]/25",
    dot: "bg-[var(--amber)]",
    label: "Pending Pricing",
  },
  draft: {
    cls: "bg-[var(--slate-bg)] text-[var(--slate)] border-[var(--slate)]/25",
    dot: "bg-[var(--slate)]",
    label: "Draft",
  },
};

function customerName(inv: TaxInvoiceRow): string {
  const c = inv.order?.customer;
  return c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : "";
}

/** Distinct brand names from the order's sub-orders (often empty under the new model). */
function brandNames(inv: TaxInvoiceRow): string {
  const names = (inv.order?.sub_orders ?? [])
    .map((s) => s.brand?.name)
    .filter((n): n is string => !!n);
  return [...new Set(names)].join(", ");
}

type FilterKey = "all" | "issued" | "needs_pricing" | "failed";

const FILTERS: { key: FilterKey; label: string; match: (r: TaxInvoiceRow) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "issued", label: "Issued", match: (r) => r.status === "issued" },
  { key: "needs_pricing", label: "Pending Pricing", match: (r) => r.status === "needs_pricing" },
  { key: "failed", label: "Failed", match: () => false }, // forward-compat; not in DB today
];

// ── Stats strip ───────────────────────────────────────────────────────────
export function TaxInvoicesStats({ invoices }: { invoices: TaxInvoiceRow[] }) {
  const total = invoices.length;
  let issued = 0;
  let pending = 0;
  for (const i of invoices) {
    if (i.status === "issued") issued++;
    else if (i.status === "needs_pricing") pending++;
  }
  const failed = 0;
  const items = [
    { label: "Total invoices", value: total, tone: "ink" as const },
    { label: "Pending Pricing", value: pending, tone: "amber" as const },
    { label: "Issued", value: issued, tone: "green" as const },
    { label: "Failed", value: failed, tone: "rose" as const },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((s) => (
        <div
          key={s.label}
          className="rounded-[14px] border border-[var(--line)] bg-[var(--panel)] px-4 py-3.5 shadow-[0_1px_2px_rgba(15,20,25,0.03)]"
        >
          <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted)]">
            {s.label}
          </div>
          <div
            className={cn(
              "mono mt-1.5 text-[22px] font-semibold leading-none tabular-nums tracking-tight",
              s.tone === "ink" && "text-[var(--ink)]",
              s.tone === "amber" && (s.value > 0 ? "text-[var(--amber)]" : "text-[var(--ink)]"),
              s.tone === "green" && (s.value > 0 ? "text-[var(--green)]" : "text-[var(--ink)]"),
              s.tone === "rose" && (s.value > 0 ? "text-[var(--rose)]" : "text-[var(--ink)]"),
            )}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Toolbar + grid ────────────────────────────────────────────────────────
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
        customerName(inv),
        brandNames(inv),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [invoices, filter, query]);

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-2 pl-3 shadow-[0_1px_2px_rgba(15,20,25,0.03)]">
        <div className="relative flex flex-1 items-center">
          <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-[var(--muted-2)]" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search invoice, order, or brand…"
            aria-label="Search tax invoices"
            className="h-9 w-full min-w-[200px] rounded-md bg-transparent pl-7 pr-3 text-[13px] text-[var(--ink)] placeholder:text-[var(--muted-2)] focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <RegenerateButton />
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const n = counts[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors",
                  active
                    ? "bg-[var(--accent)] text-white shadow-[0_1px_0_rgba(15,20,25,0.04)]"
                    : "text-[var(--ink-2)] hover:bg-[var(--hover)]",
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "mono inline-flex h-[18px] min-w-[18px] items-center justify-center rounded px-1 text-[10px] tabular-nums",
                    active ? "bg-white/15 text-white" : "bg-[var(--hover)] text-[var(--muted)]",
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards */}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((inv, i) => (
            <InvoiceCard key={inv.id} inv={inv} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Regenerate-all button ─────────────────────────────────────────────────
function RegenerateButton() {
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function run() {
    if (busy) return;
    if (!confirm("Re-render ALL tax-invoice PDFs onto the current calculation? No invoices are deleted.")) return;
    setBusy(true);
    setMsg(null);
    const res = await regenerateAllTaxInvoicesAction();
    setBusy(false);
    setMsg(
      res.ok
        ? `Done: ${res.done} regenerated${res.failed ? `, ${res.failed} failed — ${res.error ?? ""}` : ""}`
        : `Error: ${res.error}`,
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--line)] px-2.5 text-[12px] font-medium text-[var(--ink-2)] hover:bg-[var(--hover)] disabled:opacity-60"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} aria-hidden />
        {busy ? "Regenerating…" : "Regenerate PDFs"}
      </button>
      {msg && <span className="text-[11px] text-[var(--muted)]">{msg}</span>}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────
function InvoiceCard({ inv, index }: { inv: TaxInvoiceRow; index: number }) {
  const s = STATUS_STYLE[inv.status];
  const ts = inv.generated_at ?? inv.created_at;
  return (
    <Link
      href={`/tax-invoices/${inv.id}`}
      className={cn(
        "rise-in group flex flex-col gap-4 rounded-[16px] border border-[var(--line)] bg-[var(--panel)] p-5",
        "shadow-[0_1px_2px_rgba(15,20,25,0.04)] transition-all duration-200",
        "hover:-translate-y-[2px] hover:border-[var(--line-2)] hover:bg-[var(--panel)]",
        "hover:shadow-[0_8px_22px_-10px_rgba(15,20,25,0.18)]",
        "active:translate-y-0 active:shadow-[0_1px_2px_rgba(15,20,25,0.04)]",
      )}
      style={{ ["--stagger-index" as string]: String(Math.min(index, 12)) }}
    >
      {/* Top: invoice number + status */}
      <div className="flex items-start justify-between gap-3">
        <span className="mono text-[15px] font-semibold leading-none tracking-tight text-[var(--ink)]">
          {inv.invoice_number}
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-[3px] text-[11px] font-medium leading-none",
            s.cls,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden />
          {s.label}
        </span>
      </div>

      {/* Middle: meta with icons */}
      <div className="flex flex-col gap-2 text-[12.5px]">
        <MetaRow icon={Hash} muted="Order">
          <span className="mono tabular-nums text-[var(--ink-2)]">
            {inv.order?.shopify_order_number ?? "—"}
          </span>
        </MetaRow>
        <MetaRow icon={Store} muted="Customer">
          <span className="truncate font-medium text-[var(--ink-2)]">
            {customerName(inv) || "—"}
          </span>
        </MetaRow>
        {brandNames(inv) ? (
          <MetaRow icon={Tag} muted="Brand">
            <span className="truncate text-[var(--ink-2)]">{brandNames(inv)}</span>
          </MetaRow>
        ) : null}
        <MetaRow icon={Clock} muted="Updated">
          <span className="text-[var(--muted)]">{relativeTime(ts)}</span>
        </MetaRow>
      </div>

      {/* Divider — extremely subtle */}
      <div className="-mx-5 border-t border-[var(--line)]" aria-hidden />

      {/* Bottom: amount + action */}
      <div className="flex items-end justify-between gap-3">
        <span
          className={cn(
            "mono text-[22px] font-semibold leading-none tabular-nums tracking-tight",
            inv.total_fee > 0 ? "text-[var(--ink)]" : "text-[var(--muted)]",
          )}
        >
          {formatCurrency(inv.total_fee, inv.currency)}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[11.5px] font-medium text-[var(--accent)] transition-transform duration-200 group-hover:translate-x-[2px]">
          View details
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function MetaRow({
  icon: Icon,
  muted,
  children,
}: {
  icon: LucideIcon;
  muted: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--muted-2)]" aria-hidden />
      <span className="w-[64px] shrink-0 text-[11.5px] text-[var(--muted)]">{muted}</span>
      <div className="min-w-0 flex-1 truncate">{children}</div>
    </div>
  );
}

// ── Skeleton (for Suspense fallback while server fetches) ─────────────────
export function TaxInvoicesSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5">
      {/* stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[72px] rounded-[14px] border border-[var(--line)] bg-[var(--panel)]" />
        ))}
      </div>
      {/* toolbar */}
      <div className="h-[52px] rounded-[14px] border border-[var(--line)] bg-[var(--panel)]" />
      {/* card grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[210px] rounded-[16px] border border-[var(--line)] bg-[var(--panel)]" />
        ))}
      </div>
    </div>
  );
}

