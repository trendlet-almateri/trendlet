"use client";

import { useOptimistic, useTransition } from "react";
import {
  Loader2,
  AlertTriangle,
  ChevronRight,
  ShoppingBag,
  ShoppingCart,
  PackageX,
  Warehouse as WarehouseIcon,
  ClipboardCheck,
  Box,
  Truck,
  PlaneLanding,
  Bike,
  CheckCircle2,
} from "lucide-react";
import { setSubOrderStatusAction } from "./actions";
import { SupplierInvoiceDropzone } from "./supplier-invoice-dropzone";
import { STATUS_BY_CODE, type StatusCode } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/utils/date";
import type { FulfillmentRow } from "@/lib/queries/fulfillment";

const STATUS_PALETTE: Record<string, string> = {
  pending: "bg-status-pending-bg text-status-pending-fg border-status-pending-border/40",
  sourcing: "bg-status-sourcing-bg text-status-sourcing-fg border-status-sourcing-border/40",
  warehouse: "bg-status-warehouse-bg text-status-warehouse-fg border-status-warehouse-border/40",
  transit: "bg-status-transit-bg text-status-transit-fg border-status-transit-border/40",
  delivered: "bg-status-delivered-bg text-status-delivered-fg border-status-delivered-border/40",
  danger: "bg-status-danger-bg text-status-danger-fg border-status-danger-border/40",
};

const STATUS_LABEL: Record<string, { label: string; Icon: typeof ShoppingBag }> = {
  in_progress: { label: "Start work", Icon: ShoppingBag },
  purchased_in_store: { label: "Bought in store", Icon: ShoppingBag },
  purchased_online: { label: "Bought online", Icon: ShoppingCart },
  out_of_stock: { label: "Out of stock", Icon: PackageX },
  delivered_to_warehouse: { label: "At warehouse", Icon: WarehouseIcon },
  under_review: { label: "Reviewing", Icon: ClipboardCheck },
  preparing_for_shipment: { label: "Preparing", Icon: Box },
  shipped: { label: "Shipped", Icon: Truck },
  arrived_in_ksa: { label: "Arrived in KSA", Icon: PlaneLanding },
  out_for_delivery: { label: "Out for delivery", Icon: Bike },
  delivered: { label: "Delivered", Icon: CheckCircle2 },
};

function buttonVariantFor(target: string): "primary" | "secondary" | "danger" {
  if (target === "out_of_stock") return "danger";
  if (target === "delivered") return "primary";
  return "secondary";
}

function VARIANT_CLASS(v: "primary" | "secondary" | "danger"): string {
  if (v === "primary")
    return "bg-[#0f1419] text-white hover:bg-[#1a2128]";
  if (v === "danger")
    return "border border-status-danger-border/50 bg-status-danger-bg text-status-danger-fg hover:bg-status-danger-bg/80";
  return "border border-hairline bg-surface text-ink-primary hover:bg-neutral-50";
}

export function SubOrderRow({
  row,
  nextStatuses,
  canUploadReceipt = false,
}: {
  row: FulfillmentRow;
  nextStatuses: StatusCode[];
  canUploadReceipt?: boolean;
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(row.status);
  const [pending, startTransition] = useTransition();
  const palette = STATUS_BY_CODE[optimisticStatus]?.palette ?? "pending";
  const statusLabel = STATUS_BY_CODE[optimisticStatus]?.label ?? optimisticStatus;

  const advance = (target: string) => {
    startTransition(async () => {
      setOptimisticStatus(target);
      const result = await setSubOrderStatusAction({
        subOrderId: row.id,
        status: target,
      });
      if (!result.ok) {
        // Optimistic state auto-reverts at transition end on error.
        console.error("[fulfillment] status update failed", result.error);
        alert(result.error ?? "Failed to update status.");
      }
    });
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-md border border-hairline bg-surface p-4 transition-colors",
        row.is_delayed && "border-l-2 border-l-status-danger-border",
        row.is_at_risk && !row.is_delayed && "border-l-2 border-l-status-sourcing-border",
      )}
    >
      {/* Image / placeholder */}
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutral-100">
        {row.product_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.product_image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <Box className="h-5 w-5 text-ink-tertiary" aria-hidden />
        )}
      </div>

      {/* Title + meta */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink-primary truncate">{row.product_title}</span>
          {row.variant_title && (
            <span className="text-[12px] text-ink-tertiary truncate">{row.variant_title}</span>
          )}
          <span
            className={cn(
              "pill border text-[10px] flex-shrink-0",
              STATUS_PALETTE[palette] ?? STATUS_PALETTE.pending,
            )}
          >
            {statusLabel}
          </span>
          {row.brand && (
            <span className="text-[11px] text-ink-tertiary">· {row.brand.name}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-tertiary">
          {row.order && (
            <>
              <span>Order {row.order.shopify_order_number ?? "—"}</span>
              <ChevronRight className="h-3 w-3" aria-hidden />
              <span>{row.order.customer_name}</span>
              {row.order.customer_city && (
                <>
                  <span>·</span>
                  <span>{row.order.customer_city}</span>
                </>
              )}
            </>
          )}
          <span>·</span>
          <span>Qty {row.quantity}</span>
          <span>·</span>
          <span>changed {relativeTime(row.status_changed_at)}</span>
          {row.is_delayed && (
            <span className="flex items-center gap-1 text-status-danger-fg">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Delayed
            </span>
          )}
        </div>
      </div>

      {/* Status-advance buttons + receipt upload */}
      <div className="flex flex-wrap items-center gap-1.5 justify-self-end">
        {canUploadReceipt && (
          <SupplierInvoiceDropzone
            subOrderId={row.id}
            hasReceipt={row.has_supplier_receipt}
            supplierInvoiceId={row.latest_supplier_invoice_id}
          />
        )}
        {nextStatuses.length === 0 && !canUploadReceipt && (
          <span className="text-[11px] text-ink-tertiary">No actions</span>
        )}
        {nextStatuses.map((target) => {
          const meta = STATUS_LABEL[target];
          const Icon = meta?.Icon;
          const label = meta?.label ?? target;
          const variant = buttonVariantFor(target);
          return (
            <button
              key={target}
              type="button"
              onClick={() => advance(target)}
              disabled={pending}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors disabled:opacity-50",
                VARIANT_CLASS(variant),
              )}
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                Icon && <Icon className="h-3 w-3" aria-hidden />
              )}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
