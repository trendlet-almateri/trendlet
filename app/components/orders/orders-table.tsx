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
        fill={false}
        icon={Package}
        title="No orders yet"
        description="Orders will appear here as Shopify webhooks deliver them."
      />
    );
  }

  return (
    // overflow-x-auto + overflow-y-visible lets the page scroll vertically while
    // still clipping horizontally; combined with the page-level scroll context,
    // this makes `thead.sticky top-0` actually stick to the viewport.
    <div className="overflow-x-auto overflow-y-visible rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-[var(--line)] bg-[var(--hover)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] shadow-[0_1px_0_var(--line)]">
            <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Order</th>
            <th className="whitespace-nowrap px-3 py-3 text-left font-semibold">Customer</th>
            <th className="hidden whitespace-nowrap px-3 py-3 text-center font-semibold md:table-cell">Sub-orders</th>
            <th className="min-w-[160px] whitespace-nowrap px-3 py-3 text-left font-semibold">Status</th>
            <th className="hidden whitespace-nowrap px-3 py-3 text-center font-semibold md:table-cell">Total</th>
            <th className="hidden whitespace-nowrap px-3 py-3 text-center font-semibold md:table-cell">Quantity</th>
            <th className="hidden w-[120px] whitespace-nowrap px-3 py-3 text-center font-semibold md:table-cell">Alerts</th>
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
