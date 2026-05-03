import { Package } from "lucide-react";
import type { OrderRow as OrderRowData } from "@/lib/queries/orders";
import { OrderRow } from "./order-row";
import { EmptyState } from "@/components/common/empty-state";

type OrdersTableProps = {
  orders: OrderRowData[];
  onOpenDrawer?: (order: OrderRowData) => void;
};

export function OrdersTable({ orders, onOpenDrawer }: OrdersTableProps) {
  if (!orders.length) {
    return (
      <EmptyState
        icon={Package}
        title="No orders yet"
        description="Orders will appear here as Shopify webhooks deliver them."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-10">
          <tr
            className="border-b border-[var(--line)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]"
            style={{ background: "linear-gradient(180deg,var(--hover) 0%,color-mix(in srgb,var(--hover) 60%,var(--panel)) 100%)" }}
          >
            <th className="px-4 py-2.5 text-left font-semibold">Order</th>
            <th className="px-3 py-2.5 text-center font-semibold">Customer</th>
            <th className="px-3 py-2.5 text-center font-semibold">Sub-orders</th>
            <th className="px-3 py-2.5 text-center font-semibold">Status summary</th>
            <th className="px-3 py-2.5 text-center font-semibold">Total</th>
            <th className="px-3 py-2.5 text-center font-semibold">Alerts</th>
            <th className="px-3 py-2.5 text-center font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} onOpenDrawer={onOpenDrawer} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
