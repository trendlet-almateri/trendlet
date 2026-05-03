"use client";

import * as React from "react";
import { ChevronRight, AlertCircle, Clock4, Eye, Bookmark, MoreHorizontal } from "lucide-react";
import type { OrderRow as OrderRowData } from "@/lib/queries/orders";
import { StatusSummaryBar } from "@/components/status/status-summary-bar";
import { StatusPill } from "@/components/status/status-pill";
import { formatCurrency } from "@/lib/utils/currency";
import { shortDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

// ── Presentational helpers (view-only, no business logic) ────────────────────

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

function regionLabel(country?: string | null): string | null {
  if (!country) return null;
  const c = country.toUpperCase();
  if (["SA", "SAU", "SAUDI ARABIA"].includes(c)) return "KSA";
  if (["US", "USA", "UNITED STATES"].includes(c)) return "US";
  const EU = ["GB","DE","FR","IT","ES","NL","BE","AT","PT","SE","DK","FI","NO","PL","CZ","HU","RO","GR","IE","HR","CH","AE"];
  if (EU.includes(c)) return "EU";
  return country.slice(0, 3).toUpperCase();
}

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
  const [expanded, setExpanded] = React.useState(false);
  const isDragging = React.useRef(false);

  const hasUnassigned = o.sub_orders.some((s) => s.is_unassigned);
  const hasDelayed    = o.sub_orders.some((s) => s.is_delayed);
  const hasAtRisk     = o.sub_orders.some((s) => s.is_at_risk);
  const urgent        = hasUnassigned || hasDelayed;

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
    setExpanded((v) => !v);
  }

  return (
    <>
      {/* ── Main row ──────────────────────────────────────────────────────── */}
      <tr
        onClick={handleRowClick}
        data-alarm={urgent ? "true" : undefined}
        className={cn(
          "cursor-pointer border-b border-[var(--line)] transition-colors last:border-0",
          urgent ? "" : "hover:bg-[var(--hover)]",
          expanded && !urgent && "bg-[var(--hover)]",
        )}
        style={urgent ? { boxShadow: "inset 3px 0 0 var(--rose)" } : undefined}
      >
        {/* ORDER */}
        <td className="whitespace-nowrap px-4 py-3 align-middle">
          <div className="flex items-center gap-2">
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-[var(--muted-2)] transition-transform duration-150",
                expanded && "rotate-90",
              )}
              aria-hidden
            />
            <div className="flex flex-col">
              <span className="font-[family-name:var(--font-jetbrains,monospace)] text-[12px] font-semibold tabular-nums text-[var(--ink)]">
                {o.shopify_order_number}
              </span>
              <span className="font-[family-name:var(--font-jetbrains,monospace)] text-[11px] tabular-nums text-[var(--muted)]">
                {shortDate(o.shopify_created_at)}
              </span>
            </div>
          </div>
        </td>

        {/* CUSTOMER */}
        <td className="px-3 py-3 align-middle">
          <div className="flex items-center gap-2.5">
            <span className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white",
              avatarCls,
            )}>
              {initials}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[13px] font-medium text-[var(--ink)]">
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

        {/* SUB-ORDERS */}
        <td className="px-3 py-3 text-center align-middle">
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-[family-name:var(--font-jetbrains,monospace)] text-[13px] font-semibold tabular-nums text-[var(--ink)]">
              {o.sub_orders.length} / {o.sub_orders.length}
            </span>
            <span className="text-[10px] text-[var(--muted)]">vendors</span>
          </div>
        </td>

        {/* STATUS SUMMARY */}
        <td className="min-w-[180px] px-3 py-3 align-middle">
          <StatusSummaryBar subOrders={o.sub_orders} />
        </td>

        {/* TOTAL */}
        <td className="whitespace-nowrap px-3 py-3 text-center align-middle">
          <span className="font-[family-name:var(--font-jetbrains,monospace)] text-[13px] font-semibold tabular-nums text-[var(--ink)]">
            {formatCurrency(o.total ?? 0, o.currency)}
          </span>
        </td>

        {/* ALERTS */}
        <td className="px-3 py-3 align-middle">
          <div className="flex flex-wrap items-center justify-center gap-1">
            {hasUnassigned && (
              <span className="pill border border-[var(--rose)]/40 bg-[var(--rose-bg)] text-[var(--rose)]">
                <AlertCircle className="h-3 w-3" aria-hidden />
                Unassigned
              </span>
            )}
            {hasDelayed && (
              <span className="pill border border-[var(--rose)]/40 bg-[var(--rose-bg)] text-[var(--rose)]">
                Delayed
              </span>
            )}
            {hasAtRisk && !hasDelayed && (
              <span className="pill border border-[var(--amber)]/40 bg-[var(--amber-bg)] text-[var(--amber)]">
                <Clock4 className="h-3 w-3" aria-hidden />
                SLA risk
              </span>
            )}
            {!hasUnassigned && !hasDelayed && !hasAtRisk && (
              <span className="text-[12px] text-[var(--muted)]">—</span>
            )}
          </div>
        </td>

        {/* ACTIONS */}
        <td className="px-3 py-3 text-center align-middle" data-no-row-click>
          <div className="flex items-center justify-center gap-0.5">
            {onOpenDrawer && (
              <button
                type="button"
                onClick={() => onOpenDrawer(o)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]"
                aria-label={`Open details for ${o.shopify_order_number}`}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]"
              aria-label="Bookmark"
            >
              <Bookmark className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]"
              aria-label="More options"
            >
              <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </td>
      </tr>

      {/* ── Expandable sub-orders panel ───────────────────────────────────── */}
      <tr className="border-b border-[var(--line)] last:border-0">
        <td colSpan={7} className="p-0">
          <div
            style={{
              display: "grid",
              gridTemplateRows: expanded ? "1fr" : "0fr",
              transition: "grid-template-rows 0.22s cubic-bezier(.3,.7,.4,1)",
            }}
          >
            <div className="overflow-hidden">
              <div className="border-t border-[var(--line)] bg-[#f9f8f5] px-4 py-3">

                {/* Sub-header */}
                <div className="mb-2 grid grid-cols-[2.5fr_1.4fr_1.2fr_1fr_auto] items-center gap-3 px-3 text-[10px] font-semibold uppercase tracking-[0.4px] text-[var(--muted)]">
                  <span>Product</span>
                  <span>Status</span>
                  <span>Issues</span>
                  <span className="text-center">Sub-order</span>
                  <span className="w-20 text-center">Actions</span>
                </div>

                {/* Sub-order rows */}
                <div className="flex flex-col gap-1.5">
                  {o.sub_orders.map((so) => {
                    const brandLetter = (so.brand_name_raw ?? "?").slice(0, 1).toUpperCase();
                    const subNum = so.sub_order_number.split("-").slice(-2).join("-");
                    return (
                      <div
                        key={so.id}
                        className={cn(
                          "grid grid-cols-[2.5fr_1.4fr_1.2fr_1fr_auto] items-center gap-3 rounded-lg border bg-[var(--panel)] px-3 py-2.5",
                          so.is_unassigned
                            ? "border-[var(--rose)]/30 bg-[var(--rose-bg)]/20"
                            : "border-[var(--line)]",
                        )}
                      >
                        {/* Product */}
                        <div className="flex min-w-0 items-center gap-2.5">
                          {so.product_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={so.product_image_url}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-md border border-[var(--line)] bg-[var(--hover)] object-cover"
                            />
                          ) : (
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--line)] bg-[var(--hover)]">
                              <svg viewBox="0 0 20 20" className="h-4 w-4 text-[var(--muted-2)]" fill="none" stroke="currentColor" strokeWidth="1.2">
                                <rect x="3" y="3" width="14" height="14" rx="2" />
                                <line x1="3" y1="3" x2="17" y2="17" />
                                <line x1="17" y1="3" x2="3" y2="17" />
                              </svg>
                            </span>
                          )}
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-[13px] font-medium text-[var(--ink)]">
                              {so.product_title}
                              {so.quantity > 1 && (
                                <span className="ml-1.5 text-[var(--muted)]">× {so.quantity}</span>
                              )}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-navy text-[9px] font-bold text-white">
                                {brandLetter}
                              </span>
                              <span className="truncate text-[11px] text-[var(--muted)]">
                                {so.brand_name_raw ?? "—"}
                              </span>
                              <span className="text-[var(--muted)]">·</span>
                              <span className="font-[family-name:var(--font-jetbrains,monospace)] truncate text-[11px] tabular-nums text-[var(--muted)]">
                                {subNum}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status */}
                        <div>
                          {so.is_unassigned ? (
                            <span className="pill border border-[var(--rose)]/40 bg-[var(--rose-bg)] text-[var(--rose)]">
                              Unassigned · reassign
                            </span>
                          ) : (
                            <StatusPill status={so.status} />
                          )}
                        </div>

                        {/* Issues */}
                        <div className="text-[12px]">
                          {so.is_delayed ? (
                            <span className="font-semibold text-[var(--rose)]">Delayed</span>
                          ) : so.is_at_risk ? (
                            <span className="font-semibold text-[var(--amber)]">SLA at risk</span>
                          ) : (
                            <span className="text-[var(--muted)]">No issues</span>
                          )}
                        </div>

                        {/* Sub-order number */}
                        <div className="text-center">
                          <span className="font-[family-name:var(--font-jetbrains,monospace)] text-[11px] tabular-nums text-[var(--muted)]">
                            {so.sub_order_number}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex w-20 items-center justify-center gap-0.5" data-no-row-click>
                          <button
                            type="button"
                            className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]"
                            aria-label="Reassign"
                          >
                            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M13 3H7a4 4 0 000 8h5m0 0l-2-2m2 2l-2 2" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]"
                            aria-label="Flag issue"
                          >
                            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 2v12M3 2h8l-2 3.5L11 9H3" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]"
                            aria-label="More"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
