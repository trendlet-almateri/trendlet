"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Clock4 } from "lucide-react";
import type { OrderRow as OrderRowData } from "@/lib/queries/orders";
import { StatusSummaryBar } from "@/components/status/status-summary-bar";
import { formatCurrency } from "@/lib/utils/currency";
import { shortDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

type OrderRowProps = {
  order: OrderRowData;
};

export function OrderRow({ order: o }: OrderRowProps) {
  const router = useRouter();
  const href = `/orders/${o.id}`;

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

  // Don't navigate if user is selecting text or middle-clicking
  function onClick(e: React.MouseEvent<HTMLTableRowElement>) {
    if (e.button !== 0) return; // only left-click
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // let browser handle
    const target = e.target as HTMLElement;
    if (target.closest("a, button, [data-no-row-click]")) return; // inner link/button takes over
    if (window.getSelection()?.toString()) return; // user is selecting text
    router.push(href);
  }

  return (
    <tr
      onClick={onClick}
      className={cn(
        "cursor-pointer border-b border-hairline last:border-0 transition-colors hover:bg-neutral-50/50",
        urgent && "border-l-2 border-l-status-danger-border",
      )}
    >
      <td className="whitespace-nowrap px-4 py-3 align-top">
        <Link
          href={href}
          className="font-medium text-ink-primary hover:text-navy"
        >
          {o.shopify_order_number}
        </Link>
        <div className="mt-0.5 text-[11px] text-ink-tertiary">
          {shortDate(o.shopify_created_at)}
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="text-ink-primary">{customerName}</div>
        {region && <div className="mt-0.5 text-[11px] text-ink-tertiary">{region}</div>}
      </td>
      <td className="px-3 py-3 text-center align-top tabular-nums text-ink-secondary">
        {o.sub_orders.length}
      </td>
      <td className="min-w-[160px] px-3 py-3 align-top">
        <StatusSummaryBar subOrders={o.sub_orders} />
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right align-top tabular-nums text-ink-primary">
        {formatCurrency(o.total ?? 0, o.currency)}
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap gap-1.5">
          {hasUnassigned && (
            <span className="pill border border-status-danger-border/40 bg-status-danger-bg text-status-danger-fg">
              <AlertCircle className="h-3 w-3" aria-hidden />
              Unassigned
            </span>
          )}
          {hasDelayed && (
            <span className="pill border border-status-danger-border/40 bg-status-danger-bg text-status-danger-fg">
              Delayed
            </span>
          )}
          {hasAtRisk && !hasDelayed && (
            <span className="pill border border-status-sourcing-border/40 bg-status-sourcing-bg text-status-sourcing-fg">
              <Clock4 className="h-3 w-3" aria-hidden />
              SLA risk
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
