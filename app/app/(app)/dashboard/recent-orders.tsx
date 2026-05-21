"use client";

import * as React from "react";
import { OrdersTable } from "@/components/orders/orders-table";
import { OrderDrawer } from "@/components/orders/order-drawer";
import type { OrderRow } from "@/lib/queries/orders";

type Props = { orders: OrderRow[] };

export function RecentOrdersSection({ orders }: Props) {
  const [drawer, setDrawer] = React.useState<OrderRow | null>(null);
  return (
    <>
      <OrdersTable orders={orders} onOpenDrawer={setDrawer} />
      <OrderDrawer order={drawer} onClose={() => setDrawer(null)} compact />
    </>
  );
}
