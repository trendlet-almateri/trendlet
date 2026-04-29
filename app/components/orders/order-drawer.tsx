"use client";

import * as React from "react";
import { X, Download, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { shortDate } from "@/lib/utils/date";
import type { OrderRow } from "@/lib/queries/orders";

type Props = {
  order: OrderRow | null;
  onClose: () => void;
};

export function OrderDrawer({ order, onClose }: Props) {
  const [tab, setTab] = React.useState<"overview" | "suborders" | "timeline">("overview");
  const [visible, setVisible] = React.useState(false);

  // Animate in/out
  React.useEffect(() => {
    if (order) {
      setVisible(true);
      setTab("overview");
    }
  }, [order]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 220);
  }

  // Escape key
  React.useEffect(() => {
    if (!order) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [order]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!order) return null;

  const customerName = order.customer
    ? [order.customer.first_name, order.customer.last_name].filter(Boolean).join(" ") || "—"
    : "—";

  const hasDelayed = order.sub_orders.some((s) => s.is_delayed);
  const hasUnassigned = order.sub_orders.some((s) => s.is_unassigned);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{
          backgroundColor: visible ? "rgba(20,22,28,0.35)" : "rgba(20,22,28,0)",
          transition: "background-color 0.25s ease",
        }}
        onClick={handleClose}
        aria-hidden
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal
        aria-label={`Order ${order.shopify_order_number} details`}
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-[var(--panel)] shadow-[var(--shadow-md)] md:w-[540px]"
        style={{
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(.32,.72,.32,1)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--line)] px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-jetbrains,_monospace)] text-[15px] font-semibold text-[var(--ink)] tabular-nums">
                {order.shopify_order_number}
              </span>
              <span className="text-[var(--muted)]">·</span>
              <span className="text-[14px] font-medium text-[var(--ink-2)]">{customerName}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hasDelayed && (
                <span className="rounded-full bg-[var(--rose-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--rose)]">
                  Delayed
                </span>
              )}
              {hasUnassigned && (
                <span className="rounded-full bg-[var(--amber-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--amber)]">
                  Unassigned
                </span>
              )}
              {!hasDelayed && !hasUnassigned && (
                <span className="rounded-full bg-[var(--green-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--green)]">
                  On track
                </span>
              )}
              <span className="rounded-full bg-[var(--slate-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--slate)]">
                {order.sub_orders.length} sub-orders
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-px border-b border-[var(--line)] bg-[var(--line)]">
          {[
            {
              label: "Total",
              value: formatCurrency(order.total ?? 0, order.currency),
              mono: true,
            },
            {
              label: "Placed",
              value: shortDate(order.shopify_created_at),
              mono: true,
            },
            {
              label: "Sub-orders",
              value: String(order.sub_orders.length),
              mono: true,
            },
          ].map((s) => (
            <div key={s.label} className="flex flex-col gap-0.5 bg-[var(--panel)] px-4 py-3">
              <span className="text-[10px] uppercase tracking-[0.4px] text-[var(--muted)]">
                {s.label}
              </span>
              <span
                className={cn(
                  "text-[15px] font-semibold text-[var(--ink)]",
                  s.mono && "font-[family-name:var(--font-jetbrains,_monospace)] tabular-nums",
                )}
              >
                {s.value}
              </span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-[var(--line)] px-5">
          {(["overview", "suborders", "timeline"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 px-3 py-2.5 text-[12px] font-medium capitalize transition-colors",
                tab === t
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]",
              )}
            >
              {t === "suborders" ? "Sub-orders" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "overview" && (
            <div className="flex flex-col gap-4">
              {/* Customer card */}
              <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--hover)] p-4">
                <div className="mb-1 text-[10px] uppercase tracking-[0.4px] text-[var(--muted)]">Customer</div>
                <div className="text-[14px] font-medium text-[var(--ink)]">{customerName}</div>
                {order.customer?.default_address && (
                  <div className="mt-0.5 text-[12px] text-[var(--muted)]">
                    {[order.customer.default_address.city, order.customer.default_address.country]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4">
                <div className="mb-2 text-[10px] uppercase tracking-[0.4px] text-[var(--muted)]">Totals</div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--ink-2)]">Order total</span>
                  <span className="font-[family-name:var(--font-jetbrains,_monospace)] text-[14px] font-semibold tabular-nums text-[var(--ink)]">
                    {formatCurrency(order.total ?? 0, order.currency)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {tab === "suborders" && (
            <div className="flex flex-col gap-2">
              {order.sub_orders.map((so) => (
                <div
                  key={so.id}
                  className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] px-4 py-3"
                >
                  <div className="flex-1">
                    <div className="font-[family-name:var(--font-jetbrains,_monospace)] text-[12px] font-semibold tabular-nums text-[var(--ink)]">
                      {so.sub_order_number}
                    </div>
                    {so.brand_name_raw && (
                      <div className="mt-0.5 text-[11px] text-[var(--muted)]">{so.brand_name_raw}</div>
                    )}
                  </div>
                  <span className="capitalize text-[12px] text-[var(--muted)]">{so.status}</span>
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
          )}

          {tab === "timeline" && (
            <div className="flex flex-col items-center gap-2 py-8 text-[13px] text-[var(--muted)]">
              Timeline coming soon
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-[var(--line)] px-5 py-3">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-2)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md bg-[var(--green)] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:opacity-90"
          >
            <CheckCircle className="h-3.5 w-3.5" aria-hidden />
            Mark resolved
          </button>
        </div>
      </div>
    </>
  );
}
