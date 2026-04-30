"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  Loader2,
  AlertTriangle,
  ChevronRight,
  Box,
  Clock,
  X,
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

// Per-status primary-CTA label. The button advances the sub-order to the
// status's first canonical "next" — see lib/workflow/sub-order-transitions.
const PRIMARY_CTA_LABEL: Record<string, string> = {
  pending: "Start sourcing",
  assigned: "Start sourcing",
  unassigned: "Start sourcing",
  in_progress: "Mark purchased",
  purchased_in_store: "Hand off",
  purchased_online: "Hand off",
  delivered_to_warehouse: "Start review",
  under_review: "Start prep",
  preparing_for_shipment: "Mark shipped",
  shipped: "Arrived in KSA",
  arrived_in_ksa: "Mark delivered",
  out_for_delivery: "Mark delivered",
};

export function SubOrderRow({
  row,
  nextStatuses,
  canUploadReceipt = false,
  layout = "row",
}: {
  row: FulfillmentRow;
  nextStatuses: StatusCode[];
  canUploadReceipt?: boolean;
  /**
   * "row" — legacy compact list (used by /fulfillment, /pipeline).
   * "card" — sourcing card grid (used by /queue).
   */
  layout?: "row" | "card";
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(row.status);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const palette = STATUS_BY_CODE[optimisticStatus]?.palette ?? "pending";
  const statusLabel = STATUS_BY_CODE[optimisticStatus]?.label ?? optimisticStatus;

  const advance = (target: string) => {
    if (!target || target === optimisticStatus) return;
    setActionError(null);
    startTransition(async () => {
      setOptimisticStatus(target);
      const result = await setSubOrderStatusAction({
        subOrderId: row.id,
        status: target,
      });
      if (!result.ok) {
        setActionError(result.error ?? "Failed to update status.");
      }
    });
  };

  if (layout === "card") {
    const primaryTarget = nextStatuses.find((s) => s !== "cancelled" && s !== "out_of_stock");
    const cancelTarget = nextStatuses.find((s) => s === "cancelled");
    const oosTarget = nextStatuses.find((s) => s === "out_of_stock");
    const primaryLabel = primaryTarget
      ? PRIMARY_CTA_LABEL[optimisticStatus] ??
        STATUS_BY_CODE[primaryTarget]?.label ??
        primaryTarget
      : null;
    const isUrgent = row.is_delayed || row.is_at_risk;
    const brandInitials = initials(row.brand?.name);

    return (
      <article
        className={cn(
          "group relative flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-5 transition-all",
          "hover:border-accent/30 hover:shadow-[0_0_0_3px_rgba(12,68,124,0.06)]",
          row.is_delayed && "border-status-danger-border/40",
        )}
      >
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UrgencyBadge urgent={isUrgent} />
            {row.order?.shopify_order_number && (
              <span className="text-[12px] font-medium text-ink-tertiary tabular-nums">
                {row.order.shopify_order_number}
              </span>
            )}
            {row.is_delayed && (
              <span className="inline-flex items-center gap-1 text-[12px] text-status-danger-fg">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Delayed
              </span>
            )}
          </div>
          <span
            className={cn(
              "pill border text-[10px]",
              STATUS_PALETTE[palette] ?? STATUS_PALETTE.pending,
            )}
            title={`Current status: ${statusLabel}`}
          >
            {statusLabel}
          </span>
        </header>

        <div className="flex flex-col gap-1">
          <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-ink-primary">
            {row.product_title}
          </h3>
          <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink-tertiary">
            {row.brand?.name && <span>{row.brand.name}</span>}
            {row.order?.customer_name && row.order.customer_name !== "—" && (
              <>
                <span>·</span>
                <span>{row.order.customer_name}</span>
              </>
            )}
            {row.brand?.region && (
              <>
                <span>·</span>
                <span>{row.brand.region}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 text-[12px]">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutral-100">
            {row.product_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.product_image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Box className="h-4 w-4 text-ink-tertiary" aria-hidden />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-secondary">
            <span className="text-ink-tertiary">Qty</span>
            <span className="font-medium text-ink-primary tabular-nums">{row.quantity}</span>
            {row.sku && (
              <>
                <span className="text-ink-tertiary">·</span>
                <span className="font-mono text-[11px] text-ink-tertiary">{row.sku}</span>
              </>
            )}
            {canUploadReceipt && (
              <SupplierInvoiceDropzone
                subOrderId={row.id}
                hasReceipt={row.has_supplier_receipt}
                supplierInvoiceId={row.latest_supplier_invoice_id}
              />
            )}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
          <div className="flex items-center gap-2 text-[12px] text-ink-tertiary">
            <Clock className="h-3 w-3" aria-hidden />
            <span>changed {relativeTime(row.status_changed_at)}</span>
            {brandInitials && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-[9px] font-semibold uppercase tracking-wide text-accent">
                    {brandInitials}
                  </span>
                  <span>{row.brand?.name}</span>
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {oosTarget && (
              <button
                type="button"
                disabled={pending}
                onClick={() => advance(oosTarget)}
                className="text-[12px] font-medium text-status-danger-fg/80 transition-colors hover:text-status-danger-fg disabled:opacity-50"
              >
                Out of stock
              </button>
            )}
            {cancelTarget && (
              <button
                type="button"
                disabled={pending}
                onClick={() => advance(cancelTarget)}
                className="rounded-md border border-status-danger-border/40 bg-surface px-3 py-1.5 text-[12px] font-medium text-status-danger-fg transition-colors hover:bg-status-danger-bg/50 disabled:opacity-50"
              >
                Cancel order
              </button>
            )}
            {primaryTarget && primaryLabel && (
              <button
                type="button"
                disabled={pending}
                onClick={() => advance(primaryTarget)}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-navy-deep disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : null}
                {primaryLabel}
              </button>
            )}
            {!primaryTarget && !cancelTarget && !oosTarget && !canUploadReceipt && (
              <span className="text-[11px] text-ink-tertiary">No actions</span>
            )}
          </div>
        </footer>

        {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />}
      </article>
    );
  }

  // legacy row layout (used by /pipeline and /fulfillment)
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-md border border-hairline bg-surface p-4 transition-colors",
        row.is_delayed && "border-l-2 border-l-status-danger-border",
        row.is_at_risk && !row.is_delayed && "border-l-2 border-l-status-sourcing-border",
      )}
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutral-100">
        {row.product_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.product_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Box className="h-5 w-5 text-ink-tertiary" aria-hidden />
        )}
      </div>

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

      <div className="flex flex-wrap items-center gap-1.5 justify-self-end">
        {canUploadReceipt && (
          <SupplierInvoiceDropzone
            subOrderId={row.id}
            hasReceipt={row.has_supplier_receipt}
            supplierInvoiceId={row.latest_supplier_invoice_id}
          />
        )}
        {nextStatuses.length > 0 ? (
          <StatusSelect
            current={optimisticStatus}
            options={nextStatuses}
            pending={pending}
            onChange={advance}
          />
        ) : !canUploadReceipt ? (
          <span className="text-[11px] text-ink-tertiary">No actions</span>
        ) : null}
      </div>

      {actionError && (
        <div className="basis-full">
          <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />
        </div>
      )}
    </div>
  );
}

function UrgencyBadge({ urgent }: { urgent: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.6px]",
        urgent
          ? "bg-status-danger-bg text-status-danger-fg"
          : "bg-neutral-100 text-ink-tertiary",
      )}
    >
      {urgent ? "Urgent" : "Normal"}
    </span>
  );
}

function initials(name: string | undefined | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function StatusSelect({
  current,
  options,
  pending,
  onChange,
}: {
  current: string;
  options: StatusCode[];
  pending: boolean;
  onChange: (value: string) => void;
}) {
  const currentLabel = STATUS_BY_CODE[current]?.label ?? current;
  return (
    <div className="relative inline-flex items-center">
      {pending && (
        <Loader2 className="pointer-events-none absolute left-2 h-3 w-3 animate-spin text-ink-tertiary" aria-hidden />
      )}
      <select
        value=""
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-7 appearance-none rounded-md border border-hairline bg-surface pr-7 text-[11px] font-medium text-ink-primary transition-colors hover:bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-ink-primary disabled:opacity-50",
          pending ? "pl-7" : "pl-2",
        )}
        aria-label={`Change status from ${currentLabel}`}
      >
        <option value="" disabled>
          Change status…
        </option>
        {options.map((target) => (
          <option key={target} value={target}>
            {STATUS_BY_CODE[target]?.label ?? target}
          </option>
        ))}
      </select>
      <ChevronDownIcon />
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      className="pointer-events-none absolute right-2 h-3 w-3 text-ink-tertiary"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-status-danger-border/40 bg-status-danger-bg/40 px-3 py-2 text-[12px] text-status-danger-fg">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="inline-flex h-5 w-5 items-center justify-center rounded-md text-status-danger-fg/80 hover:bg-status-danger-bg"
        aria-label="Dismiss error"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </div>
  );
}
