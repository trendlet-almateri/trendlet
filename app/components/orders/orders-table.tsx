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
      {/* table-fixed + percentage widths = deterministic, proportional columns.
          Widths are sized by content importance and renormalize automatically
          when the md-only columns drop out on tablet/mobile. */}
      <table className="w-full table-fixed border-collapse text-[13px]">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-[var(--line)] bg-[var(--hover)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] shadow-[0_1px_0_var(--line)]">
            <th className="w-[10%] whitespace-nowrap px-4 py-3 text-left font-semibold">Order</th>
            <th className="w-[24%] px-3 py-3 text-left font-semibold">Customer</th>
            <th className="hidden w-[12%] whitespace-nowrap px-3 py-3 text-center font-semibold md:table-cell">Sub-orders</th>
            <th className="w-[18%] whitespace-nowrap px-3 py-3 text-center font-semibold">Status</th>
            <th className="hidden w-[14%] whitespace-nowrap px-3 py-3 text-center font-semibold md:table-cell">Total</th>
            <th className="hidden w-[8%] whitespace-nowrap px-3 py-3 text-center font-semibold md:table-cell">Quantity</th>
            <th className="hidden w-[14%] whitespace-nowrap px-3 py-3 text-center font-semibold md:table-cell">Alerts</th>
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
