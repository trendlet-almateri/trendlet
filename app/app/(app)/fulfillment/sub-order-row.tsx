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
import { ConfirmStatusModal } from "@/components/status/confirm-status-modal";

const STATUS_PALETTE: Record<string, string> = {
  pending: "bg-status-pending-bg text-status-pending-fg border-status-pending-border/40",
  sourcing: "bg-status-sourcing-bg text-status-sourcing-fg border-status-sourcing-border/40",
  warehouse: "bg-status-warehouse-bg text-status-warehouse-fg border-status-warehouse-border/40",
  transit: "bg-status-transit-bg text-status-transit-fg border-status-transit-border/40",
  delivered: "bg-status-delivered-bg text-status-delivered-fg border-status-delivered-border/40",
  danger: "bg-status-danger-bg text-status-danger-fg border-status-danger-border/40",
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
  const [pendingTarget, setPendingTarget] = useState<StatusCode | null>(null);
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

  const requestAdvance = (target: StatusCode) => {
    if (!target || target === optimisticStatus) return;
    setPendingTarget(target);
  };

  const confirmAdvance = () => {
    if (!pendingTarget) return;
    const target = pendingTarget;
    setPendingTarget(null);
    advance(target);
  };

  if (layout === "card") {
    const cancelTarget = nextStatuses.find((s) => s === "cancelled");
    const oosTarget = nextStatuses.find((s) => s === "out_of_stock");
    const forwardTargets = nextStatuses.filter(
      (s) => s !== "cancelled" && s !== "out_of_stock",
    );
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            {oosTarget && (
              <button
                type="button"
                disabled={pending}
                onClick={() => requestAdvance(oosTarget)}
                className="text-[12px] font-medium text-status-danger-fg/80 transition-colors hover:text-status-danger-fg disabled:opacity-50"
              >
                Out of stock
              </button>
            )}
            {cancelTarget && (
              <button
                type="button"
                disabled={pending}
                onClick={() => requestAdvance(cancelTarget)}
                className="rounded-md border border-status-danger-border/40 bg-surface px-3 py-1.5 text-[12px] font-medium text-status-danger-fg transition-colors hover:bg-status-danger-bg/50 disabled:opacity-50"
              >
                Cancel order
              </button>
            )}
            {forwardTargets.length > 0 && (
              <StatusJumpSelect
                options={forwardTargets}
                disabled={pending}
                onSelect={(target) => requestAdvance(target as StatusCode)}
                primary
              />
            )}
            {pending && (
              <Loader2 className="h-3 w-3 animate-spin text-ink-tertiary" aria-hidden />
            )}
            {forwardTargets.length === 0 && !cancelTarget && !oosTarget && !canUploadReceipt && (
              <span className="text-[11px] text-ink-tertiary">No actions</span>
            )}
          </div>
        </footer>

        {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />}

        {pendingTarget && (
          <ConfirmStatusModal
            target={pendingTarget}
            subOrderNumber={row.sub_order_number}
            productTitle={row.product_title}
            customerName={row.order?.customer_name ?? null}
            customerPhone={row.order?.customer_phone ?? null}
            onCancel={() => setPendingTarget(null)}
            onConfirm={confirmAdvance}
          />
        )}
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
        {(() => {
          const cancelT = nextStatuses.find((s) => s === "cancelled");
          const oosT = nextStatuses.find((s) => s === "out_of_stock");
          const forwards = nextStatuses.filter((s) => s !== "cancelled" && s !== "out_of_stock");
          if (nextStatuses.length === 0) {
            return canUploadReceipt ? null : (
              <span className="text-[11px] text-ink-tertiary">No actions</span>
            );
          }
          return (
            <>
              {oosT && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => requestAdvance(oosT as StatusCode)}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 text-[11px] font-medium text-status-danger-fg/80 transition-colors hover:text-status-danger-fg hover:bg-neutral-50 disabled:opacity-50"
                >
                  Out of stock
                </button>
              )}
              {cancelT && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => requestAdvance(cancelT as StatusCode)}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-status-danger-border/40 bg-surface px-2.5 text-[11px] font-medium text-status-danger-fg transition-colors hover:bg-status-danger-bg/50 disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
              {forwards.length > 0 && (
                <StatusJumpSelect
                  options={forwards}
                  disabled={pending}
                  onSelect={(target) => requestAdvance(target as StatusCode)}
                  compact
                  primary
                />
              )}
              {pending && (
                <Loader2 className="h-3 w-3 animate-spin text-ink-tertiary" aria-hidden />
              )}
            </>
          );
        })()}
      </div>

      {actionError && (
        <div className="basis-full">
          <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />
        </div>
      )}

      {pendingTarget && (
        <ConfirmStatusModal
          target={pendingTarget}
          subOrderNumber={row.sub_order_number}
          productTitle={row.product_title}
          customerName={row.order?.customer_name ?? null}
          customerPhone={row.order?.customer_phone ?? null}
          onCancel={() => setPendingTarget(null)}
          onConfirm={confirmAdvance}
        />
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

/**
 * Power-user shortcut: jump to any allowed next status without scanning
 * the per-status buttons. Resets to the empty option after each pick so
 * the same status can be selected twice in a row (the optimistic state
 * may briefly mismatch the server). Routes through the same
 * requestAdvance → ConfirmStatusModal path as the buttons, so the
 * WhatsApp-preview rule is preserved.
 */
function StatusJumpSelect({
  options,
  disabled,
  onSelect,
  compact = false,
  primary = false,
}: {
  options: string[];
  disabled?: boolean;
  onSelect: (target: string) => void;
  compact?: boolean;
  /** Render as the accent (primary) action — the only forward CTA. */
  primary?: boolean;
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value=""
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          if (v) onSelect(v);
          e.currentTarget.value = "";
        }}
        className={cn(
          "appearance-none rounded-md pr-7 font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 cursor-pointer",
          primary
            ? "bg-accent text-white shadow-sm hover:bg-navy-deep hover:shadow-md hover:-translate-y-px"
            : "border border-hairline bg-surface text-ink-primary hover:bg-neutral-50 hover:border-hairline-strong",
          compact ? "h-7 pl-2 text-[11px]" : "h-8 pl-3 text-[12px]",
        )}
        aria-label="Change status"
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
      <svg
        className={cn(
          "pointer-events-none absolute right-2 h-3 w-3",
          primary ? "text-white/80" : "text-ink-tertiary",
        )}
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden
      >
        <path
          d="M3 4.5L6 7.5L9 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
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

