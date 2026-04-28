import { Package } from "lucide-react";
import type { OrderRow as OrderRowData } from "@/lib/queries/orders";
import { OrderRow } from "./order-row";
import { EmptyState } from "@/components/common/empty-state";

type OrdersTableProps = {
  orders: OrderRowData[];
};

export function OrdersTable({ orders }: OrdersTableProps) {
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
    <div className="overflow-hidden rounded-md border border-hairline bg-surface">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-hairline bg-neutral-50/50 text-left text-[11px] font-medium uppercase tracking-[0.4px] text-ink-tertiary">
            <th className="px-4 py-2 font-medium">Order</th>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="w-20 px-3 py-2 text-center font-medium">Subs</th>
            <th className="px-3 py-2 font-medium">Status summary</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
            <th className="px-3 py-2 font-medium">Alerts</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
