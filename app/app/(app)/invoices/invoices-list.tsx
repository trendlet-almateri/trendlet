"use client";

/**
 * Invoices — responsive grid of premium cards with toolbar (search + filters)
 * and a 4-up stats strip. Matches the Tax Invoices visual language.
 */

import * as React from "react";
import Link from "next/link";
import {
  ChevronRight,
  Clock,
  Hash,
  Receipt,
  Search,
  User,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/lib/utils/currency";
import { relativeTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { InvoiceRow, InvoiceStatus } from "@/lib/queries/invoices";

// ── Status visuals (semantic, restrained, leading dot) ────────────────────
const STATUS_STYLE: Record<InvoiceStatus, { cls: string; dot: string; label: string }> = {
  pending_review: {
    cls: "bg-[var(--amber-bg)] text-[var(--amber)] border-[var(--amber)]/25",
    dot: "bg-[var(--amber)]",
    label: "Pending Review",
  },
  approved: {
    cls: "bg-[var(--green-bg)] text-[var(--green)] border-[var(--green)]/25",
    dot: "bg-[var(--green)]",
    label: "Approved",
  },
  sent: {
    cls: "bg-[var(--blue-bg)] text-[var(--blue)] border-[var(--blue)]/25",
    dot: "bg-[var(--blue)]",
    label: "Sent",
  },
  rejected: {
    cls: "bg-[var(--rose-bg)] text-[var(--rose)] border-[var(--rose)]/25",
    dot: "bg-[var(--rose)]",
    label: "Rejected",
  },
  draft: {
    cls: "bg-[var(--slate-bg)] text-[var(--slate)] border-[var(--slate)]/25",
    dot: "bg-[var(--slate)]",
    label: "Draft",
  },
};

type FilterKey = "all" | InvoiceStatus;

const FILTERS: { key: FilterKey; label: string; match: (r: InvoiceRow) => boolean }[] = [
  { key: "all",            label: "All",            match: () => true },
  { key: "pending_review", label: "Pending Review", match: (r) => r.status === "pending_review" },
  { key: "approved",       label: "Approved",       match: (r) => r.status === "approved" },
  { key: "sent",           label: "Sent",           match: (r) => r.status === "sent" },
  { key: "rejected",       label: "Rejected",       match: (r) => r.status === "rejected" },
];

// ── Stats strip (4 cards matching tax-invoices) ───────────────────────────
export function InvoicesStats({
  invoices,
  counts,
  pendingHeadline,
  otherCurrencyCount,
}: {
  invoices: InvoiceRow[];
  counts: Record<InvoiceStatus, number>;
  pendingHeadline: [string, number] | null;
  otherCurrencyCount: number;
}) {
  void invoices;
  const items = [
    {
      label: "Awaiting Review",
      value: String(counts.pending_review),
      tone: "amber" as const,
      hint: counts.pending_review === 0 ? "no drafts" : null,
    },
    {
      label: "Approved",
      value: String(counts.approved),
      tone: "green" as const,
      hint: null,
    },
    {
      label: "Sent",
      value: String(counts.sent),
      tone: "blue" as const,
      hint: null,
    },
    {
      label: "Pending Value",
      value: pendingHeadline
        ? formatCurrency(pendingHeadline[1], pendingHeadline[0], { compact: true })
        : "—",
      tone: "ink" as const,
      hint:
        pendingHeadline && otherCurrencyCount > 0
          ? `+ ${otherCurrencyCount} more ${otherCurrencyCount === 1 ? "currency" : "currencies"}`
          : null,
    },
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
              s.tone === "amber" && (Number(s.value) > 0 ? "text-[var(--amber)]" : "text-[var(--ink)]"),
              s.tone === "green" && (Number(s.value) > 0 ? "text-[var(--green)]" : "text-[var(--ink)]"),
              s.tone === "blue"  && (Number(s.value) > 0 ? "text-[var(--blue)]"  : "text-[var(--ink)]"),
            )}
          >
            {s.value}
          </div>
          {s.hint && (
            <div className="mt-1 text-[11px] text-[var(--muted)]">{s.hint}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Toolbar + grid ────────────────────────────────────────────────────────
export function InvoicesList({
  invoices,
  counts,
}: {
  invoices: InvoiceRow[];
  counts: Record<InvoiceStatus, number>;
}) {
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [query, setQuery] = React.useState("");

  const filterCounts: Record<FilterKey, number> = {
    all: invoices.length,
    pending_review: counts.pending_review,
    approved: counts.approved,
    sent: counts.sent,
    rejected: counts.rejected,
    draft: counts.draft,
  };

  const filtered = React.useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (!f.match(inv)) return false;
      if (!q) return true;
      const customer = inv.order?.customer
        ? [inv.order.customer.first_name, inv.order.customer.last_name].filter(Boolean).join(" ")
        : "";
      const hay = [
        inv.invoice_number,
        inv.order?.shopify_order_number ?? "",
        customer,
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
            placeholder="Search invoice, order, or customer…"
            aria-label="Search invoices"
            className="h-9 w-full min-w-[200px] rounded-md bg-transparent pl-7 pr-3 text-[13px] text-[var(--ink)] placeholder:text-[var(--muted-2)] focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const n = filterCounts[f.key];
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
          title={query || filter !== "all" ? "No invoices match" : "No invoices yet"}
          description={
            query || filter !== "all"
              ? "Try a different filter or clear the search."
              : "Customer invoices are generated after a supplier invoice is uploaded and items are mapped."
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

// ── Card ──────────────────────────────────────────────────────────────────
function InvoiceCard({ inv, index }: { inv: InvoiceRow; index: number }) {
  const s = STATUS_STYLE[inv.status];
  const ts = inv.generated_at ?? inv.created_at;
  const customerName = inv.order?.customer
    ? [inv.order.customer.first_name, inv.order.customer.last_name].filter(Boolean).join(" ") || "—"
    : "—";

  return (
    <Link
      href={`/invoices/${inv.id}`}
      className={cn(
        "rise-in group flex flex-col gap-4 rounded-[16px] border border-[var(--line)] bg-[var(--panel)] p-5",
        "shadow-[0_1px_2px_rgba(15,20,25,0.04)] transition-all duration-200",
        "hover:-translate-y-[2px] hover:border-[var(--line-2)] hover:bg-[var(--panel)]",
        "hover:shadow-[0_8px_22px_-10px_rgba(15,20,25,0.18)]",
        "active:translate-y-0 active:shadow-[0_1px_2px_rgba(15,20,25,0.04)]",
      )}
      style={{ ["--stagger-index" as string]: String(Math.min(index, 12)) }}
    >
      {/* Top */}
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

      {/* Middle */}
      <div className="flex flex-col gap-2 text-[12.5px]">
        {inv.sub_order_number || inv.order?.shopify_order_number ? (
          <MetaRow icon={Hash} muted="Order">
            <span className="mono tabular-nums text-[var(--ink-2)]">
              {inv.sub_order_number ?? inv.order?.shopify_order_number}
            </span>
          </MetaRow>
        ) : null}
        <MetaRow icon={User} muted="Customer">
          <span className="truncate font-medium text-[var(--ink-2)]">{customerName}</span>
        </MetaRow>
        <MetaRow icon={Clock} muted="Updated">
          <span className="text-[var(--muted)]">{relativeTime(ts)}</span>
        </MetaRow>
      </div>

      {/* Divider */}
      <div className="-mx-5 border-t border-[var(--line)]" aria-hidden />

      {/* Bottom */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col items-start gap-1">
          <span
            className={cn(
              "mono text-[22px] font-semibold leading-none tabular-nums tracking-tight",
              (inv.total ?? 0) > 0 ? "text-[var(--ink)]" : "text-[var(--muted)]",
            )}
          >
            {formatCurrency(inv.total ?? 0, inv.total_currency)}
          </span>
          {inv.profit_amount != null ? (
            <span className="mono text-[11px] tabular-nums text-[var(--muted)]">
              Profit {formatCurrency(inv.profit_amount, inv.total_currency)}
              {inv.profit_percent != null ? <> · {Number(inv.profit_percent).toFixed(0)}%</> : null}
            </span>
          ) : null}
        </div>
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

// ── Skeleton ──────────────────────────────────────────────────────────────
export function InvoicesSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[72px] rounded-[14px] border border-[var(--line)] bg-[var(--panel)]" />
        ))}
      </div>
      <div className="h-[52px] rounded-[14px] border border-[var(--line)] bg-[var(--panel)]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[210px] rounded-[16px] border border-[var(--line)] bg-[var(--panel)]" />
        ))}
      </div>
    </div>
  );
}
