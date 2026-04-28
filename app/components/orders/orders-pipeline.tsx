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
  { key: "pending",                 label: "Pending",     dot: "bg-status-pending-border" },
  { key: "sourcing",                label: "In progress", dot: "bg-status-sourcing-border" },
  { key: "purchased",               label: "Purchased",   dot: "bg-status-warehouse-border" },
  { key: "delivered_to_warehouse",  label: "Warehouse",   dot: "bg-purple-400" },
  { key: "shipped",                 label: "Shipping",    dot: "bg-status-transit-border" },
  { key: "delivered",               label: "Delivered",   dot: "bg-status-delivered-border" },
];

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

const AVATAR_COLORS = [
  "bg-navy", "bg-purple-500", "bg-emerald-600",
  "bg-orange-500", "bg-sky-600", "bg-rose-600",
];

function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

type Props = { orders: OrderRow[] };

export function OrdersPipeline({ orders }: Props) {
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
        subOrderNumber: so.sub_order_number,
        orderNumber: order.shopify_order_number,
        brandName: so.brand_name_raw,
        customerName,
        customerInitials: getInitials(customerName),
        total: order.total ?? 0,
        currency: order.currency,
        isDelayed: so.is_delayed,
        isUnassigned: so.is_unassigned,
        isAtRisk: so.is_at_risk,
      });
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const cards = byStatus.get(col.key) ?? [];
        return (
          <div key={col.key} className="flex w-[195px] shrink-0 flex-col gap-2">
            {/* Column header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                <span className="text-[12px] font-semibold text-ink-primary">{col.label}</span>
              </div>
              <span className="text-[11px] tabular-nums text-ink-tertiary">{cards.length}</span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2">
              {cards.length === 0 && (
                <div className="rounded-xl border border-dashed border-hairline px-3 py-6 text-center text-[11px] text-ink-tertiary">
                  Empty
                </div>
              )}
              {cards.map((card, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col gap-2.5 rounded-xl border bg-surface p-3",
                    card.isDelayed
                      ? "border-l-2 border-l-status-danger-border border-t-hairline border-r-hairline border-b-hairline"
                      : card.isUnassigned
                        ? "border-l-2 border-l-status-sourcing-border border-t-hairline border-r-hairline border-b-hairline"
                        : "border-hairline",
                  )}
                >
                  {/* Sub-order + badge */}
                  <div className="flex items-start justify-between gap-1">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.4px] text-ink-tertiary">
                      {card.orderNumber}
                      <span className="text-ink-tertiary/50"> · </span>
                      {card.subOrderNumber.split("-").slice(-2).join("-")}
                    </div>
                    {card.isDelayed && (
                      <span className="shrink-0 rounded-full bg-status-danger-bg px-1.5 py-0.5 text-[9px] font-semibold text-status-danger-fg">
                        Delayed
                      </span>
                    )}
                    {card.isUnassigned && !card.isDelayed && (
                      <span className="shrink-0 rounded-full bg-status-sourcing-bg px-1.5 py-0.5 text-[9px] font-semibold text-status-sourcing-fg">
                        Assign
                      </span>
                    )}
                  </div>

                  {/* Brand */}
                  {card.brandName && (
                    <div className="text-[11px] font-medium text-ink-secondary">{card.brandName}</div>
                  )}

                  {/* Customer + price */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white",
                          avatarColor(card.customerName),
                        )}
                      >
                        {card.customerInitials}
                      </span>
                      <span className="truncate text-[11px] text-ink-secondary">
                        {card.customerName}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-ink-primary">
                      {formatCurrency(card.total, card.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
