"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertCircle, AlertTriangle, Clock4, X } from "lucide-react";
import type { OrderRow as OrderRowData } from "@/lib/queries/orders";
import { StatusSummaryBar } from "@/components/status/status-summary-bar";
import { StatusPill } from "@/components/status/status-pill";
import { regionLabel } from "@/lib/utils/region";
import { deriveOrderCancelState } from "@/lib/workflow/order-cancel-state";
import { formatCurrency } from "@/lib/utils/currency";
import { shortDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

// ── Presentational helpers ────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500",
  "bg-amber-500",  "bg-rose-500", "bg-cyan-500",
  "bg-orange-500", "bg-indigo-500",
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function getInitials(first: string | null, last: string | null): string {
  return [(first ?? "")[0], (last ?? "")[0]].filter(Boolean).join("").toUpperCase() || "?";
}

// Shared with the Orders filter dropdown so the bucket here always agrees
// with what the filter offers (KSA / US / EU / 3-letter fallback).
// Implementation lives in lib/utils/region.ts.

const REGION_CLS: Record<string, string> = {
  KSA: "bg-emerald-100 text-emerald-700",
  US:  "bg-blue-100 text-blue-700",
  EU:  "bg-violet-100 text-violet-700",
};

// ── Component ────────────────────────────────────────────────────────────────

type OrderRowProps = {
  order: OrderRowData;
  onOpenDrawer?: (order: OrderRowData) => void;
};

export function OrderRow({ order: o, onOpenDrawer }: OrderRowProps) {
  const [showDetail, setShowDetail] = React.useState(false);
  const isDragging = React.useRef(false);

  const cancelState        = deriveOrderCancelState(o.sub_orders);
  const isCancelled        = cancelState === "all";
  const isPartialCancelled = cancelState === "partial";
  const isRefunded         = !isCancelled && o.financial_status === "refunded";
  const isPartialRefunded  = !isCancelled && o.financial_status === "partially_refunded";
  const hasUnassigned = !isCancelled && o.sub_orders.some((s) => s.is_unassigned);
  const hasDelayed    = !isCancelled && o.sub_orders.some((s) => s.is_delayed);
  const hasAtRisk     = !isCancelled && o.sub_orders.some((s) => s.is_at_risk);
  const doneCount = o.sub_orders.filter((s) => s.status === "delivered" || s.status === "cancelled").length;

  const customerName = o.customer
    ? [o.customer.first_name, o.customer.last_name].filter(Boolean).join(" ") || "—"
    : "—";
  const country  = o.customer?.default_address?.country;
  const region   = regionLabel(country);
  const initials = getInitials(o.customer?.first_name ?? null, o.customer?.last_name ?? null);
  const avatarCls = avatarColor(customerName);

  function handleRowClick(e: React.MouseEvent) {
    if (isDragging.current) return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button, [data-no-row-click]")) return;
    if (window.getSelection()?.toString()) return;
    if (window.innerWidth < 768) {
      setShowDetail(true);
    } else {
      onOpenDrawer?.(o);
    }
  }

  return (
    <>
      {/* ── Main row ──────────────────────────────────────────────────────── */}
      <tr
        onClick={handleRowClick}
        data-alarm={(hasUnassigned || hasDelayed) ? "true" : undefined}
        className={cn(
          "cursor-pointer border-b border-[var(--line)] transition-colors last:border-0",
          "hover:bg-[var(--hover)]",
          isCancelled && "bg-[var(--rose-bg)]/10",
        )}
        style={
          (hasUnassigned || hasDelayed) ? { boxShadow: "inset 3px 0 0 var(--rose)" }
          : hasAtRisk                   ? { boxShadow: "inset 3px 0 0 var(--amber)" }
          : undefined
        }
      >
        {/* ORDER */}
        <td className="whitespace-nowrap px-4 py-4 align-middle">
          <div className="flex flex-col gap-0.5">
              <span className={cn(
                "font-[family-name:var(--font-jetbrains,monospace)] text-[12px] font-semibold tabular-nums",
                isCancelled ? "text-[var(--muted)]" : "text-[var(--ink)]",
              )}>
                {o.shopify_order_number}
              </span>
              {isCancelled ? (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold border border-[var(--rose)]/30 bg-[var(--rose-bg)] text-[var(--rose)] w-fit">
                  Cancelled
                </span>
              ) : isRefunded ? (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold border border-[var(--amber)]/30 bg-[var(--amber-bg)] text-[var(--amber)] w-fit">
                  Refunded
                </span>
              ) : isPartialRefunded ? (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold border border-[var(--amber)]/30 bg-[var(--amber-bg)] text-[var(--amber)] w-fit">
                  Partial refund
                </span>
              ) : (
                <span className="font-[family-name:var(--font-jetbrains,monospace)] text-[11px] tabular-nums text-[var(--muted)]">
                  {shortDate(o.shopify_created_at)}
                </span>
              )}
          </div>
        </td>

        {/* CUSTOMER — greedy column: absorbs the table's leftover width so the
            other columns stay snug. Truncation still works via the inner
            min-w-0 + truncate, so long names clip instead of stretching. */}
        <td className="w-full max-w-0 overflow-hidden px-3 py-4 align-middle">
          <div className="flex items-center gap-2.5">
            <span className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white",
              isCancelled ? "bg-[var(--muted-2)] grayscale opacity-60" : avatarCls,
            )}>
              {initials}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className={cn(
                "truncate text-[13px] font-medium",
                isCancelled ? "text-[var(--muted)] line-through decoration-[var(--muted)]/50" : "text-[var(--ink)]",
              )}>
                {customerName}
              </span>
              <div className="flex items-center gap-1.5">
                {region && (
                  <span className={cn(
                    "rounded px-1.5 py-px text-[10px] font-semibold",
                    REGION_CLS[region] ?? "bg-[var(--hover)] text-[var(--muted)]",
                  )}>
                    {region}
                  </span>
                )}
                <span className="text-[11px] text-[var(--muted)]">Shopify</span>
              </div>
            </div>
          </div>
        </td>

        {/* SUB-ORDERS — desktop only */}
        <td className="hidden px-3 py-4 text-center align-middle md:table-cell">
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-[family-name:var(--font-jetbrains,monospace)] text-[13px] font-semibold tabular-nums text-[var(--ink)]">
              {doneCount} / {o.sub_orders.length}
            </span>
            <span className="text-[10px] text-[var(--muted)]">vendors</span>
          </div>
        </td>

        {/* STATUS SUMMARY */}
        <td className="min-w-[160px] whitespace-nowrap px-3 py-4 align-middle">
          {isCancelled ? (
            <span className="pill whitespace-nowrap border border-[var(--rose)]/30 bg-[var(--rose-bg)] text-[var(--rose)]">
              <X className="h-3 w-3 shrink-0" aria-hidden />
              Cancelled
            </span>
          ) : isPartialCancelled ? (
            <div className="flex flex-col gap-1">
              <span className="pill w-fit whitespace-nowrap border border-[var(--rose)]/30 bg-[var(--rose-bg)] text-[var(--rose)]">
                <X className="h-3 w-3 shrink-0" aria-hidden />
                Partially cancelled
              </span>
              <StatusSummaryBar subOrders={o.sub_orders} />
            </div>
          ) : o.sub_orders.length === 1 ? (
            // Single sub-order: one clean badge — no full-width bar.
            <StatusPill
              status={o.sub_orders[0].status}
              isUnassigned={o.sub_orders[0].is_unassigned}
            />
          ) : (
            // Multi sub-order: proportional bar earns its keep.
            <StatusSummaryBar subOrders={o.sub_orders} />
          )}
        </td>

        {/* TOTAL — desktop only */}
        <td className="hidden whitespace-nowrap px-3 py-4 text-center align-middle md:table-cell">
          <span className={cn(
            "font-[family-name:var(--font-jetbrains,monospace)] text-[13px] font-semibold tabular-nums",
            isCancelled || isRefunded
              ? "text-[var(--muted)] line-through decoration-[var(--muted)]/50"
              : isPartialRefunded
              ? "text-[var(--amber)]"
              : "text-[var(--ink)]",
          )}>
            {formatCurrency(o.total ?? 0, o.currency)}
          </span>
        </td>

        {/* QUANTITY — desktop only */}
        <td className="hidden whitespace-nowrap px-3 py-4 text-center align-middle md:table-cell">
          <span className="font-[family-name:var(--font-jetbrains,monospace)] text-[13px] font-semibold tabular-nums text-[var(--ink)]">
            {o.sub_orders.reduce((sum, s) => sum + s.quantity, 0)}
          </span>
        </td>

        {/* ALERTS — desktop only */}
        <td className="hidden px-3 py-4 align-middle md:table-cell">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {isCancelled || (!hasUnassigned && !hasDelayed && !hasAtRisk) ? (
              <span className="inline-flex items-center rounded-md border border-[var(--line)] bg-[var(--hover)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--muted)]">
                No alerts
              </span>
            ) : (
              <>
                {hasUnassigned && (
                  <span className="pill border border-[var(--rose)]/40 bg-[var(--rose-bg)] text-[var(--rose)]">
                    <AlertCircle className="h-3 w-3" aria-hidden />
                    Unassigned
                  </span>
                )}
                {hasDelayed && (
                  <span title="Delayed" aria-label="Delayed">
                    <Clock4 className="h-3.5 w-3.5 text-[var(--rose)]" aria-hidden />
                  </span>
                )}
                {hasAtRisk && !hasDelayed && (
                  <span title="SLA at risk" aria-label="SLA at risk">
                    <AlertTriangle className="h-3.5 w-3.5 text-[var(--amber)]" aria-hidden />
                  </span>
                )}
              </>
            )}
          </div>
        </td>

      </tr>


      {/* ── Mobile detail card (portal) ───────────────────────────────────── */}
      {showDetail && typeof document !== "undefined" && createPortal(
        <MobileDetailCard order={o} onClose={() => setShowDetail(false)} />,
        document.body,
      )}
    </>
  );
}

// ── Mobile detail card ────────────────────────────────────────────────────────

function MobileDetailCard({ order: o, onClose }: { order: OrderRowData; onClose: () => void }) {
  const hasUnassigned = o.sub_orders.some((s) => s.is_unassigned);
  const hasDelayed    = o.sub_orders.some((s) => s.is_delayed);
  const hasAtRisk     = o.sub_orders.some((s) => s.is_at_risk);

  const customerName = o.customer
    ? [o.customer.first_name, o.customer.last_name].filter(Boolean).join(" ") || "—"
    : "—";
  const country = o.customer?.default_address?.country;
  const region  = regionLabel(country);
  const initials = getInitials(o.customer?.first_name ?? null, o.customer?.last_name ?? null);
  const avatarCls = avatarColor(customerName);

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[rgba(15,20,25,0.5)]"
        style={{ animation: "backdropIn 0.2s ease forwards" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-md)]"
        style={{ animation: "slideUp 0.25s cubic-bezier(0.32,0.72,0.32,1) forwards" }}
      >
        {/* Handle + header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-jetbrains,monospace)] text-[14px] font-bold text-[var(--ink)]">
              {o.shopify_order_number}
            </span>
            <span className="text-[12px] text-[var(--muted)]">{shortDate(o.shopify_created_at)}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          {/* Customer */}
          <div className="flex items-center gap-3">
            <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white", avatarCls)}>
              {initials}
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] font-semibold text-[var(--ink)]">{customerName}</span>
              <div className="flex items-center gap-1.5">
                {region && (
                  <span className={cn("rounded px-1.5 py-px text-[10px] font-semibold", REGION_CLS[region] ?? "bg-[var(--hover)] text-[var(--muted)]")}>
                    {region}
                  </span>
                )}
                <span className="text-[11px] text-[var(--muted)]">Shopify</span>
              </div>
            </div>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-3 divide-x divide-[var(--line)] rounded-[var(--radius)] border border-[var(--line)] bg-[var(--hover)]">
            <div className="flex flex-col items-center gap-0.5 px-3 py-3">
              <span className="font-[family-name:var(--font-jetbrains,monospace)] text-[15px] font-semibold text-[var(--ink)]">
                {formatCurrency(o.total ?? 0, o.currency)}
              </span>
              <span className="text-[10px] text-[var(--muted)]">Total</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-3 py-3">
              <span className="font-[family-name:var(--font-jetbrains,monospace)] text-[15px] font-semibold text-[var(--ink)]">
                {o.sub_orders.length}
              </span>
              <span className="text-[10px] text-[var(--muted)]">Sub-orders</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-3 py-3">
              <span className="text-[15px] font-semibold text-[var(--ink)]">
                {hasUnassigned || hasDelayed || hasAtRisk ? (
                  <span className={hasUnassigned || hasDelayed ? "text-[var(--rose)]" : "text-[var(--amber)]"}>!</span>
                ) : "✓"}
              </span>
              <span className="text-[10px] text-[var(--muted)]">Alerts</span>
            </div>
          </div>

          {/* Status bar */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.4px] text-[var(--muted)]">Status</p>
            <StatusSummaryBar subOrders={o.sub_orders} />
          </div>

          {/* Alert pills */}
          {(hasUnassigned || hasDelayed || hasAtRisk) && (
            <div className="flex flex-wrap gap-1.5">
              {hasUnassigned && (
                <span className="pill border border-[var(--rose)]/40 bg-[var(--rose-bg)] text-[var(--rose)]">
                  <AlertCircle className="h-3 w-3" aria-hidden /> Unassigned
                </span>
              )}
              {hasDelayed && (
                <span className="pill border border-[var(--rose)]/40 bg-[var(--rose-bg)] text-[var(--rose)]">Delayed</span>
              )}
              {hasAtRisk && !hasDelayed && (
                <span className="pill border border-[var(--amber)]/40 bg-[var(--amber-bg)] text-[var(--amber)]">
                  <Clock4 className="h-3 w-3" aria-hidden /> SLA risk
                </span>
              )}
            </div>
          )}

          {/* Sub-orders list */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.4px] text-[var(--muted)]">Items</p>
            <div className="flex flex-col gap-2">
              {o.sub_orders.map((so) => {
                const brandLetter = (so.brand_name_raw ?? "?").slice(0, 1).toUpperCase();
                return (
                  <div
                    key={so.id}
                    className={cn(
                      "flex items-center gap-3 rounded-[var(--radius)] border bg-[var(--panel)] px-3 py-2.5",
                      so.is_unassigned ? "border-[var(--rose)]/30 bg-[var(--rose-bg)]/20" : "border-[var(--line)]",
                    )}
                  >
                    {so.product_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={so.product_image_url} alt="" className="h-10 w-10 shrink-0 rounded-md border border-[var(--line)] object-cover" />
                    ) : (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[var(--line)] bg-[var(--hover)]">
                        <svg viewBox="0 0 20 20" className="h-4 w-4 text-[var(--muted-2)]" fill="none" stroke="currentColor" strokeWidth="1.2">
                          <rect x="3" y="3" width="14" height="14" rx="2" />
                          <line x1="3" y1="3" x2="17" y2="17" />
                          <line x1="17" y1="3" x2="3" y2="17" />
                        </svg>
                      </span>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[13px] font-medium text-[var(--ink)]">
                        {so.product_title}
                        {so.quantity > 1 && <span className="ml-1 text-[var(--muted)]">× {so.quantity}</span>}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-navy text-[9px] font-bold text-white">{brandLetter}</span>
                        <span className="truncate text-[11px] text-[var(--muted)]">{so.brand_name_raw ?? "—"}</span>
                      </div>
                    </div>
                    <StatusPill status={so.status} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
