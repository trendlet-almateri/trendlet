"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { OrderRow } from "@/lib/queries/orders";

type PipelineCard = {
  subOrderNumber: string;
  orderNumber: string;
  brandName: string | null;
  customerName: string;
  customerInitials: string;
  total: number;
  currency: string;
  isDelayed: boolean;
  isUnassigned: boolean;
  isAtRisk: boolean;
};

const COLUMNS: { key: string; label: string; dot: string }[] = [
  { key: "pending",                label: "Pending",      dot: "bg-[#888780]" },
  { key: "sourcing",               label: "In progress",  dot: "bg-[#EF9F27]" },
  { key: "purchased",              label: "Purchased",    dot: "bg-[#378ADD]" },
  { key: "delivered_to_warehouse", label: "Warehouse",    dot: "bg-purple-400" },
  { key: "shipped",                label: "Shipping",     dot: "bg-[#7F77DD]" },
  { key: "delivered",              label: "Delivered",    dot: "bg-[#1D9E75]" },
];

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

const AVATAR_COLORS = [
  "bg-[#0C447C]", "bg-purple-500", "bg-emerald-600",
  "bg-orange-500", "bg-sky-600",   "bg-rose-600",
];

function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

type Props = { orders: OrderRow[] };

export function OrdersPipeline({ orders }: Props) {
  const pipeRef = React.useRef<HTMLDivElement>(null);

  // Drag-to-pan
  React.useEffect(() => {
    const pipe = pipeRef.current;
    if (!pipe) return;

    let isDown = false;
    let startX = 0;
    let startScroll = 0;

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDown = true;
      startX = e.pageX;
      startScroll = pipe.scrollLeft;
    };

    const onMove = (e: MouseEvent) => {
      if (!isDown) return;
      const dx = e.pageX - startX;
      if (Math.abs(dx) > 4 && !pipe.classList.contains("dragging")) {
        pipe.classList.add("dragging");
      }
      if (pipe.classList.contains("dragging")) {
        e.preventDefault();
        pipe.scrollLeft = startScroll - dx;
      }
    };

    const onUp = () => {
      if (!isDown) return;
      isDown = false;
      setTimeout(() => pipe.classList.remove("dragging"), 0);
    };

    pipe.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      pipe.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Build per-column card lists
  const byStatus = new Map<string, PipelineCard[]>(COLUMNS.map((c) => [c.key, []]));

  for (const order of orders) {
    const customerName =
      order.customer
        ? [order.customer.first_name, order.customer.last_name].filter(Boolean).join(" ") || "—"
        : "—";

    for (const so of order.sub_orders) {
      const colKey = so.is_unassigned ? "pending" : (so.status as string);
      const bucket = byStatus.get(colKey) ?? byStatus.get("pending")!;
      bucket.push({
        subOrderNumber:    so.sub_order_number,
        orderNumber:       order.shopify_order_number,
        brandName:         so.brand_name_raw,
        customerName,
        customerInitials:  getInitials(customerName),
        total:             order.total ?? 0,
        currency:          order.currency,
        isDelayed:         so.is_delayed,
        isUnassigned:      so.is_unassigned,
        isAtRisk:          so.is_at_risk,
      });
    }
  }

  return (
    <div
      ref={pipeRef}
      className="pipeline select-none"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, minmax(200px, 1fr))",
        gap: "12px",
        overflowX: "auto",
        cursor: "grab",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        paddingBottom: "4px",
      }}
    >
      {COLUMNS.map((col) => {
        const cards = byStatus.get(col.key) ?? [];
        return (
          <div key={col.key} className="flex flex-col gap-2">
            {/* Column header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                <span className="text-[12px] font-semibold text-[var(--ink)]">{col.label}</span>
              </div>
              <span className="font-[family-name:var(--font-jetbrains,_monospace)] text-[11px] tabular-nums text-[var(--muted)]">
                {cards.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2">
              {cards.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--line)] px-3 py-6 text-center text-[11px] text-[var(--muted)]">
                  No sub-orders
                </div>
              ) : (
                cards.map((card, i) => (
                  <PipelineCardItem key={i} card={card} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PipelineCardItem({ card }: { card: PipelineCard }) {
  const isFlagged = card.isDelayed || card.isUnassigned;

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl bg-[var(--panel)] p-3 shadow-[var(--shadow-sm)]",
        isFlagged
          ? "border border-[#e9b8b2] border-l-2 border-l-[var(--rose)]"
          : "border border-[var(--line)]",
      )}
    >
      {/* Order ref + badge */}
      <div className="flex items-start justify-between gap-1">
        <div className="font-[family-name:var(--font-jetbrains,_monospace)] text-[10px] font-semibold uppercase tracking-[0.4px] text-[var(--muted)] [font-variant-numeric:tabular-nums]">
          {card.orderNumber}
          <span className="text-[var(--muted-2)]"> · </span>
          {card.subOrderNumber.split("-").slice(-2).join("-")}
        </div>
        {card.isDelayed && (
          <span className="shrink-0 rounded-full bg-[var(--rose-bg)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--rose)]">
            Delayed
          </span>
        )}
        {card.isUnassigned && !card.isDelayed && (
          <span className="shrink-0 rounded-full bg-[var(--amber-bg)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--amber)]">
            Assign
          </span>
        )}
        {card.isAtRisk && !card.isDelayed && !card.isUnassigned && (
          <span className="shrink-0 rounded-full bg-[var(--amber-bg)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--amber)]">
            At risk
          </span>
        )}
      </div>

      {/* Brand */}
      {card.brandName && (
        <div className="text-[11px] font-medium text-[var(--ink-2)]">{card.brandName}</div>
      )}

      {/* Customer + price */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white",
              avatarColor(card.customerName),
            )}
          >
            {card.customerInitials}
          </span>
          <span className="truncate text-[11px] text-[var(--muted)]">{card.customerName}</span>
        </div>
        <span className="shrink-0 font-[family-name:var(--font-jetbrains,_monospace)] text-[11px] font-semibold tabular-nums text-[var(--ink)]">
          {formatCurrency(card.total, card.currency)}
        </span>
      </div>
    </div>
  );
}
