"use client";

import * as React from "react";
import { ChevronRight, AlertCircle, Clock4, Eye } from "lucide-react";
import type { OrderRow as OrderRowData } from "@/lib/queries/orders";
import { StatusSummaryBar } from "@/components/status/status-summary-bar";
import { formatCurrency } from "@/lib/utils/currency";
import { shortDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

type OrderRowProps = {
  order: OrderRowData;
  onOpenDrawer?: (order: OrderRowData) => void;
};

export function OrderRow({ order: o, onOpenDrawer }: OrderRowProps) {
  const [expanded, setExpanded] = React.useState(false);
  const isDragging = React.useRef(false);

  const hasUnassigned = o.sub_orders.some((s) => s.is_unassigned);
  const hasDelayed = o.sub_orders.some((s) => s.is_delayed);
  const hasAtRisk = o.sub_orders.some((s) => s.is_at_risk);
  const urgent = hasUnassigned || hasDelayed;

  const customerName = o.customer
    ? [o.customer.first_name, o.customer.last_name].filter(Boolean).join(" ") || "—"
    : "—";
  const region = o.customer?.default_address?.country
    ? o.customer.default_address.city ?? o.customer.default_address.country
    : "";

  function handleRowClick(e: React.MouseEvent) {
    if (isDragging.current) return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button, [data-no-row-click]")) return;
    if (window.getSelection()?.toString()) return;
    setExpanded((v) => !v);
  }

  return (
    <>
      <tr
        onClick={handleRowClick}
        data-alarm={urgent ? "true" : undefined}
        className={cn(
          "cursor-pointer border-b border-[var(--line)] transition-colors last:border-0",
          urgent
            ? "border-l-2 border-l-[var(--rose)]"
            : "hover:bg-[var(--hover)]",
          expanded && !urgent && "bg-[var(--hover)]",
        )}
        style={urgent ? { boxShadow: "inset 3px 0 0 var(--rose)" } : undefined}
      >
        {/* Order ID + date */}
        <td className="whitespace-nowrap px-4 py-3 align-top">
          <div className="flex items-center gap-1.5">
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-[var(--muted-2)] transition-transform duration-150",
                expanded && "rotate-90",
              )}
              aria-hidden
            />
            <div>
              <span
                className="font-[family-name:var(--font-jetbrains,_monospace)] text-[13px] font-semibold text-[var(--ink)] [font-variant-numeric:tabular-nums]"
              >
                {o.shopify_order_number}
              </span>
              <div className="mt-0.5 font-[family-name:var(--font-jetbrains,_monospace)] text-[11px] text-[var(--muted)] [font-variant-numeric:tabular-nums]">
                {shortDate(o.shopify_created_at)}
              </div>
            </div>
          </div>
        </td>

        {/* Customer */}
        <td className="px-3 py-3 align-top">
          <div className="text-[var(--ink)]">{customerName}</div>
          {region && <div className="mt-0.5 text-[11px] text-[var(--muted)]">{region}</div>}
        </td>

        {/* Sub count */}
        <td className="px-3 py-3 text-center align-top">
          <span className="font-[family-name:var(--font-jetbrains,_monospace)] tabular-nums text-[var(--muted)]">
            {o.sub_orders.length}
          </span>
        </td>

        {/* Status summary */}
        <td className="min-w-[160px] px-3 py-3 align-top">
          <StatusSummaryBar subOrders={o.sub_orders} />
        </td>

        {/* Total */}
        <td className="whitespace-nowrap px-3 py-3 text-right align-top">
          <span className="font-[family-name:var(--font-jetbrains,_monospace)] tabular-nums text-[var(--ink)] [font-variant-numeric:tabular-nums]">
            {formatCurrency(o.total ?? 0, o.currency)}
          </span>
        </td>

        {/* Alerts + eye icon */}
        <td className="px-3 py-3 align-top">
          <div className="flex flex-wrap items-center gap-1.5">
            {hasUnassigned && (
              <span className="pill border border-[var(--rose)]/40 bg-[var(--rose-bg)] text-[var(--rose)]">
                <AlertCircle className="h-3 w-3" aria-hidden />
                Unassigned
              </span>
            )}
            {hasDelayed && (
              <span className="pill bg-[var(--rose-bg)] text-[var(--rose)]">
                Delayed
              </span>
            )}
            {hasAtRisk && !hasDelayed && (
              <span className="pill bg-[var(--amber-bg)] text-[var(--amber)]">
                <Clock4 className="h-3 w-3" aria-hidden />
                SLA risk
              </span>
            )}
            {onOpenDrawer && (
              <button
                type="button"
                data-no-row-click
                onClick={() => onOpenDrawer(o)}
                className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]"
                aria-label={`Open details for order ${o.shopify_order_number}`}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expandable sub-orders panel */}
      <tr className="border-b border-[var(--line)] last:border-0">
        <td colSpan={6} className="p-0">
          <div
            style={{
              display: "grid",
              gridTemplateRows: expanded ? "1fr" : "0fr",
              transition: "grid-template-rows 0.22s cubic-bezier(.3,.7,.4,1)",
            }}
          >
            <div className="overflow-hidden">
              <div className="bg-[#faf9f6] px-4 py-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">
                  Sub-orders ({o.sub_orders.length})
                </div>
                <div className="flex flex-col gap-1.5">
                  {o.sub_orders.map((so) => (
                    <div
                      key={so.id}
                      className="flex items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12px]"
                    >
                      <span className="font-[family-name:var(--font-jetbrains,_monospace)] tabular-nums text-[var(--muted)]">
                        {so.sub_order_number.split("-").slice(-2).join("-")}
                      </span>
                      {so.brand_name_raw && (
                        <span className="text-[var(--ink-2)]">{so.brand_name_raw}</span>
                      )}
                      <span className="ml-auto capitalize text-[var(--muted)]">{so.status}</span>
                      {so.is_delayed && (
                        <span className="rounded-full bg-[var(--rose-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--rose)]">
                          Delayed
                        </span>
                      )}
                      {so.is_unassigned && (
                        <span className="rounded-full bg-[var(--amber-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--amber)]">
                          Unassigned
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
