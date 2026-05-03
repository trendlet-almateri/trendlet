"use client";

import { useState, useTransition } from "react";
import { Clock, ScanBarcode, MoreHorizontal, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_BY_CODE, type StatusCode } from "@/lib/constants";
import { relativeTime } from "@/lib/utils/date";
import type { FulfillmentRow } from "@/lib/queries/fulfillment";
import { setSubOrderStatusAction } from "@/app/(app)/fulfillment/actions";
import { ConfirmStatusModal } from "@/components/status/confirm-status-modal";

// ─── Status label overrides ───────────────────────────────────────────────────
const STATUS_LABELS: Partial<Record<string, string>> = {
  delivered_to_warehouse: "At warehouse",
  preparing_for_shipment: "Preparing shipment",
  under_review:           "Under review",
  shipped:                "Shipped",
  delivered:              "Delivered",
};

// ─── Status palette ────────────────────────────────────────────────────────────
const STATUS_PALETTE: Record<string, string> = {
  pending:   "border-[rgba(180,130,30,0.3)] bg-amber-50 text-amber-700",
  sourcing:  "border-[rgba(12,68,124,0.25)] bg-blue-50 text-blue-700",
  warehouse: "border-[rgba(59,130,246,0.25)] bg-blue-100 text-blue-800",
  transit:   "border-[rgba(99,102,241,0.25)] bg-indigo-50 text-indigo-700",
  delivered: "border-[rgba(34,197,94,0.25)] bg-green-50 text-green-700",
  danger:    "border-[rgba(239,68,68,0.25)] bg-red-50 text-red-600",
};

// ─── Action buttons per status ────────────────────────────────────────────────
function getWarehouseActions(status: string): StatusCode[] {
  if (status === "delivered_to_warehouse" || status === "under_review") {
    return ["preparing_for_shipment" as StatusCode];
  }
  if (status === "preparing_for_shipment") {
    return ["shipped" as StatusCode];
  }
  return [];
}

const BTN_LABELS: Partial<Record<string, string>> = {
  preparing_for_shipment: "Prepare for shipment",
  shipped:                "Mark shipped",
};

// ─── Types ────────────────────────────────────────────────────────────────────
export type WarehouseToast = {
  id: string;
  message: string;
  sub: string;
  kind: "info" | "success";
};

type Props = {
  row: FulfillmentRow;
  isReadOnly: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onToast: (t: WarehouseToast) => void;
  selfName?: string;
  selfInitials?: string;
};

export function WarehouseCard({
  row,
  isReadOnly,
  isSelected,
  onSelect,
  onDeselect,
  onToast,
  selfName,
  selfInitials,
}: Props) {
  const [optimisticStatus, setOptimisticStatus] = useState(row.status);
  const [pending, startTransition] = useTransition();
  const [pendingTarget, setPendingTarget] = useState<StatusCode | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const isUrgent = row.is_delayed || row.is_at_risk;
  const palette = STATUS_BY_CODE[optimisticStatus]?.palette ?? "warehouse";
  const statusLabel =
    STATUS_LABELS[optimisticStatus] ??
    STATUS_BY_CODE[optimisticStatus]?.label ??
    optimisticStatus;

  const assignee = selfName
    ? { name: selfName, initials: selfInitials ?? selfName.slice(0, 2).toUpperCase() }
    : null;

  const forwardTargets = isReadOnly ? [] : getWarehouseActions(optimisticStatus);

  const advance = (target: StatusCode) => {
    setPendingTarget(null);
    const prev = optimisticStatus;
    setOptimisticStatus(target);
    startTransition(async () => {
      const result = await setSubOrderStatusAction({ subOrderId: row.id, status: target });
      if (result.ok) {
        const isHandoff = target === "shipped";
        const region = row.brand?.region ?? "KSA";
        onToast({
          id: `${row.id}-${Date.now()}`,
          message: isHandoff ? "Task completed" : `Status updated: ${BTN_LABELS[target] ?? statusLabel}`,
          sub: isHandoff
            ? `${row.order?.shopify_order_number ?? row.sub_order_number} → ready for ${region} dispatch`
            : "",
          kind: isHandoff ? "success" : "info",
        });
        onDeselect();
      } else {
        setOptimisticStatus(prev);
      }
    });
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, [role=menuitem]")) return;
    isSelected ? onDeselect() : onSelect();
  };

  return (
    <>
      <article
        onClick={handleCardClick}
        className={cn(
          "relative flex cursor-pointer flex-col rounded-xl border bg-white transition-all duration-150 select-none",
          isUrgent ? "border-red-200 bg-red-50/30" : "border-[var(--line)]",
          isSelected
            ? "border-[#1e3a5f] ring-2 ring-[#1e3a5f]/20 shadow-[0_4px_20px_rgba(30,58,95,0.15)]"
            : "hover:border-[var(--line)] hover:shadow-[var(--shadow-sm)]",
          pending && "opacity-70",
        )}
      >
        {/* Urgent left rail */}
        {isUrgent && (
          <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl bg-red-400" aria-hidden />
        )}

        <div className="flex flex-col gap-2.5 p-4 pl-5">
          {/* ── Header ── */}
          <header className="flex flex-wrap items-center gap-1.5">
            {row.order?.shopify_order_number && (
              <span className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">
                {row.order.shopify_order_number}
              </span>
            )}
            <span className={cn(
              "rounded-md border px-1.5 py-px text-[10px] font-medium",
              STATUS_PALETTE[palette] ?? STATUS_PALETTE.warehouse,
            )}>
              {statusLabel}
            </span>
            {isUrgent && (
              <span className="rounded-md border border-red-300/60 bg-red-100 px-1.5 py-px text-[10px] font-semibold text-red-600">
                URGENT
              </span>
            )}
            {row.is_delayed && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Delayed
              </span>
            )}

            {/* 3-dot menu — always in header */}
            <div className="relative ml-auto">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                className="grid h-6 w-6 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-7 z-20 min-w-[140px] rounded-xl border border-[var(--line)] bg-white py-1 shadow-[var(--shadow-md)]"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center px-3 py-1.5 text-[13px] text-[var(--ink)] hover:bg-[var(--hover)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Reassign
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center px-3 py-1.5 text-[13px] text-[var(--ink)] hover:bg-[var(--hover)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Add note
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center px-3 py-1.5 text-[13px] text-[var(--ink)] hover:bg-[var(--hover)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Mark urgent
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* ── Title + subtitle ── */}
          <div>
            <h3 className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[var(--ink)]">
              {row.product_title}
            </h3>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">
              Brand: {row.brand?.name ?? "—"} · qty {row.quantity}
              {row.brand?.region && ` · ${row.brand.region}`}
            </p>
          </div>

          {/* ── SKU row (real schema field) ── */}
          {row.sku && (
            <div className="border-t border-[var(--line)] pt-2.5">
              <InfoRow
                icon={<ScanBarcode className="h-3 w-3 text-[var(--muted)]" />}
                label="SKU"
                value={row.sku}
              />
            </div>
          )}

          {/* ── Footer ── */}
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-2.5">
            <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
              <Clock className="h-3 w-3 shrink-0" aria-hidden />
              <span>{relativeTime(row.status_changed_at)}</span>
              {assignee && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[9px] font-semibold text-[var(--accent)]">
                      {assignee.initials}
                    </span>
                    {assignee.name}
                  </span>
                </>
              )}
            </div>

            {/* Action buttons — visible only when selected and not read-only */}
            {isSelected && !isReadOnly && forwardTargets.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {pending && <Loader2 className="h-3 w-3 animate-spin text-[var(--muted)]" />}
                {forwardTargets.map((t) => (
                  <ActionBtn
                    key={t}
                    label={BTN_LABELS[t] ?? STATUS_BY_CODE[t]?.label ?? t}
                    variant="primary"
                    disabled={pending}
                    onClick={() => setPendingTarget(t)}
                  />
                ))}
              </div>
            )}

            {/* Completed: show status label */}
            {isReadOnly && (
              <span className="text-[11px] italic text-[var(--muted)]">{statusLabel}</span>
            )}
          </footer>
        </div>
      </article>

      {pendingTarget && (
        <ConfirmStatusModal
          target={pendingTarget}
          subOrderNumber={row.sub_order_number}
          productTitle={row.product_title}
          customerName={row.order?.customer_name ?? null}
          customerPhone={row.order?.customer_phone ?? null}
          onCancel={() => setPendingTarget(null)}
          onConfirm={() => advance(pendingTarget)}
        />
      )}
    </>
  );
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-start gap-2 text-[12px]">
      <span className="flex items-center gap-1.5 text-[var(--muted)]">
        {icon}
        {label}
      </span>
      <span className="font-medium text-[var(--ink)]">{value}</span>
    </div>
  );
}

function ActionBtn({
  label, variant, disabled, onClick,
}: {
  label: string;
  variant: "primary" | "secondary";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all disabled:opacity-50",
        variant === "primary" && "bg-[#1e3a5f] text-white hover:bg-[#152d4a]",
        variant === "secondary" && "border border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[var(--hover)]",
      )}
    >
      {label}
    </button>
  );
}
