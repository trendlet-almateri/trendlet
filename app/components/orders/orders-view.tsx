"use client";

import { useState } from "react";
import { LayoutList, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrdersTable } from "./orders-table";
import { OrdersPipeline } from "./orders-pipeline";
import type { OrderRow } from "@/lib/queries/orders";

type Props = {
  orders: OrderRow[];
  totalCount: number;
};

export function OrdersView({ orders, totalCount }: Props) {
  const [view, setView] = useState<"table" | "pipeline">("table");

  return (
    <div className="flex flex-col gap-3">
      {/* Toggle */}
      <div className="flex items-center justify-end">
        <div className="flex items-center rounded-lg border border-hairline bg-surface p-0.5">
          <button
            onClick={() => setView("table")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
              view === "table"
                ? "bg-ink-primary text-white"
                : "text-ink-secondary hover:text-ink-primary",
            )}
          >
            <LayoutList className="h-3.5 w-3.5" aria-hidden />
            Table
          </button>
          <button
            onClick={() => setView("pipeline")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
              view === "pipeline"
                ? "bg-ink-primary text-white"
                : "text-ink-secondary hover:text-ink-primary",
            )}
          >
            <GitBranch className="h-3.5 w-3.5" aria-hidden />
            Pipeline
          </button>
        </div>
      </div>

      {/* View */}
      {view === "table" ? (
        <>
          <OrdersTable orders={orders} />
          <div className="text-[11px] text-ink-tertiary">
            Showing {orders.length} of {totalCount} orders
          </div>
        </>
      ) : (
        <OrdersPipeline orders={orders} />
      )}
    </div>
  );
}
