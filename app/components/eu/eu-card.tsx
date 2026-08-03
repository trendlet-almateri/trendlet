"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock, MoreHorizontal, AlertTriangle, Loader2, ScanBarcode } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_BY_CODE, type StatusCode } from "@/lib/constants";
import { relativeTime } from "@/lib/utils/date";
import { formatSubOrderNumber } from "@/lib/utils/sub-order";
import type { FulfillmentRow } from "@/lib/queries/fulfillment";
import { setSubOrderStatusAction } from "@/app/(app)/fulfillment/actions";
import { ConfirmStatusModal } from "@/components/status/confirm-status-modal";
import { isCustomerNotifyStatus } from "@/lib/integrations/twilio-templates";
import { PerformerTag } from "@/components/fulfillment/performer-tag";

// Skip the WhatsApp confirm modal when notifications are disabled — the
// modal would just be theater since no message would actually send.
// Controlled by NEXT_PUBLIC_TWILIO_NOTIFICATIONS_ENABLED ("true" to enable).
const NOTIFICATIONS_ENABLED =
  process.env.NEXT_PUBLIC_TWILIO_NOTIFICATIONS_ENABLED === "true";

// ─── Stage detection ───────────────────────────────────────────────────────────
// Warehouse-side of the fulfiller flow: from "delivered_to_warehouse"
// onward. Drives the "Warehouse" badge vs. "Sourcing" badge in the card.
const WAREHOUSE_STAGE = new Set([
  "delivered_to_warehouse", "shipped",
]);

// ─── EU status labels ──────────────────────────────────────────────────────────
const EU_STATUS_LABELS: Record<string, string> = {
  pending:                "Searching supplier",
  assigned:               "Searching supplier",
  unassigned:             "Searching supplier",
  in_progress:            "Negotiation",
  purchased_in_store:     "Supplier selected",
  purchased_online:       "Supplier selected",
  delivered_to_warehouse: "Received at warehouse",
  shipped:                "Shipped",
  delivered:              "Delivered",
  out_of_stock:           "Out of stock",
};

// ─── Action button labels ──────────────────────────────────────────────────────
const EU_BTN_LABELS: Record<string, string> = {
  in_progress:            "Start sourcing",
  purchased_online:       "Purchased online",
  purchased_in_store:     "Purchased in-store",
  out_of_stock:           "Out of stock",
  delivered_to_warehouse: "Deliver to warehouse",
  shipped:                "Mark shipped",
  delivered:              "Mark delivered",
};

// Fulfiller owns sourcing + warehouse end-to-end:
//   pending → in_progress → purchased_* / out_of_stock
//          → delivered_to_warehouse → shipped → delivered
// Statuses a cancel makes no sense from (already ended).
const EU_TERMINAL_NO_CANCEL = new Set<string>([
  "cancelled",
  "delivered",
  "returned",
  "failed",
  "out_of_stock",
]);

function getEuActions(status: string, isAdmin: boolean): StatusCode[] {
  let actions: StatusCode[];
  switch (status) {
    case "pending":
    case "assigned":
    case "unassigned":
      actions = ["in_progress" as StatusCode];
      break;
    case "in_progress":
      actions = [
        "purchased_online" as StatusCode,
        "purchased_in_store" as StatusCode,
        "out_of_stock" as StatusCode,
      ];
      break;
    case "purchased_online":
    case "purchased_in_store":
      actions = ["delivered_to_warehouse" as StatusCode];
      break;
    case "delivered_to_warehouse":
      actions = ["shipped" as StatusCode];
      break;
    case "shipped":
      actions = ["delivered" as StatusCode];
      break;
    default:
      actions = [];
  }
  // Admin may cancel from any non-terminal status. Non-admins never see
  // cancel here (DB enforce_status_whitelist is the matching boundary).
  if (isAdmin && !EU_TERMINAL_NO_CANCEL.has(status)) {
    actions = [...actions, "cancelled" as StatusCode];
  }
  return actions;
}

// ─── Status palette ────────────────────────────────────────────────────────────
const STATUS_PALETTE: Record<string, string> = {
  pending:   "border-[rgba(180,130,30,0.3)] bg-amber-50 text-amber-700",
  sourcing:  "border-[rgba(12,68,124,0.25)] bg-blue-50 text-blue-700",
  warehouse: "border-[rgba(59,130,246,0.25)] bg-blue-100 text-blue-800",
  transit:   "border-[rgba(99,102,241,0.25)] bg-indigo-50 text-indigo-700",
  delivered: "border-[rgba(34,197,94,0.25)] bg-green-50 text-green-700",
  danger:    "border-[rgba(239,68,68,0.25)] bg-red-50 text-red-600",
};

// ─── Types ─────────────────────────────────────────────────────────────────────
export type EuToast = {
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
  onToast: (t: EuToast) => void;
  selfName?: string;
  selfInitials?: string;
  isAdmin?: boolean;
};

export function EuCard({
  row,
  isReadOnly,
  isSelected,
  onSelect,
  onDeselect,
  onToast,
  selfName,
  selfInitials,
  isAdmin = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [optimisticStatus, setOptimisticStatus] = useState(row.status);

  // Re-sync optimistic state to props when the server returns a fresh row
  // (after revalidatePath). Without this, the card stays on the previous
  // status visually after a successful transition, which makes the next
  // button never appear and the row look stuck. Fix for the "after I
  // press a button nothing happens" loop the user kept hitting.
  useEffect(() => {
    setOptimisticStatus(row.status);
  }, [row.status]);
  const [pending, startTransition] = useTransition();
  const [pendingTarget, setPendingTarget] = useState<StatusCode | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const isUrgent = row.is_delayed || row.is_at_risk;
  const isWarehouseStage = WAREHOUSE_STAGE.has(optimisticStatus);
  const palette = STATUS_BY_CODE[optimisticStatus]?.palette ?? "pending";
  const statusLabel = EU_STATUS_LABELS[optimisticStatus] ?? optimisticStatus;

  const assignee = selfName
    ? { name: selfName, initials: selfInitials ?? selfName.slice(0, 2).toUpperCase() }
    : null;

  const euActions = isReadOnly ? [] : getEuActions(optimisticStatus, isAdmin);
  const cancelTarget = euActions.find((s) => s === "cancelled");
  const forwardTargets = euActions.filter((s) => s !== "cancelled");

  // Cancelling a sub-order past purchase has financial / return
  // consequences — admin must explicitly confirm. Mirrors the webhook's
  // post-purchase threshold for consistency.
  const RISKY_CANCEL_FROM = new Set<string>([
    "purchased_in_store",
    "purchased_online",
    "delivered_to_warehouse",
    "shipped",
    "delivered",
    "under_review",
    "preparing_for_shipment",
    "arrived_in_ksa",
    "out_for_delivery",
  ]);
  const isRiskyCancel = (target: StatusCode) =>
    target === "cancelled" && RISKY_CANCEL_FROM.has(optimisticStatus);

  // If notifications are off OR target doesn't notify the customer, skip
  // the confirm modal — it adds friction without protecting anything
  // (no real WhatsApp would be sent). Risky cancels always confirm.
  const requestStatusChange = (target: StatusCode) => {
    if (isRiskyCancel(target)) {
      setPendingTarget(target);
      return;
    }
    if (!NOTIFICATIONS_ENABLED || !isCustomerNotifyStatus(target)) {
      advance(target);
      return;
    }
    setPendingTarget(target);
  };

  const advance = (target: StatusCode) => {
    setPendingTarget(null);
    const prev = optimisticStatus;
    setOptimisticStatus(target);
    startTransition(async () => {
      // EU is end-to-end: "delivered" is the success terminal,
      // "out_of_stock" is the failure terminal. Both move to the
      // Completed tab. "shipped" is mid-stage for EU (next button
      // is "Mark delivered"), so it's NOT a completion event here.
      const isFinal = target === "delivered" || target === "out_of_stock";
      const result = await setSubOrderStatusAction({
        subOrderId: row.id,
        status: target,
        markDone: isFinal,
      });
      if (result.ok) {
        const orderRef = row.order?.shopify_order_number ?? row.sub_order_number;
        onToast({
          id: `${row.id}-${Date.now()}`,
          message: isFinal ? "Task completed" : `Status updated: ${EU_BTN_LABELS[target] ?? target}`,
          sub: isFinal
            ? `${orderRef} → moved to Completed`
            : "",
          kind: isFinal ? "success" : "info",
        });
        onDeselect();
        if (isFinal) {
          const sp = new URLSearchParams(searchParams?.toString() ?? "");
          sp.set("tab", "completed");
          router.push(`/eu-fulfillment?${sp.toString()}`);
        }
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
        {isUrgent && (
          <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl bg-red-400" aria-hidden />
        )}

        <div className="flex flex-col gap-2.5 p-4 pl-5">
          {/* ── Header ── */}
          <header className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">
              {formatSubOrderNumber(row.sub_order_number, row.order?.item_count)}
            </span>

            {/* Status pill */}
            <span className={cn(
              "rounded-md border px-1.5 py-px text-[10px] font-medium",
              STATUS_PALETTE[palette] ?? STATUS_PALETTE.pending,
            )}>
              {statusLabel}
            </span>

            {/* Stage badge */}
            <span className={cn(
              "rounded-md border px-1.5 py-px text-[10px] font-medium",
              isWarehouseStage
                ? "border-blue-200 bg-blue-50 text-blue-600"
                : "border-amber-200 bg-amber-50 text-amber-700",
            )}>
              {isWarehouseStage ? "Warehouse" : "Sourcing"}
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

            {/* 3-dot menu */}
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

          {/* ── SKU row (warehouse stage, real schema field) ── */}
          {isWarehouseStage && row.sku && (
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
              {/* Admin-only performer (null for non-admins → renders nothing) */}
              <PerformerTag changedBy={row.changed_by} status={row.status} isReadOnly={isReadOnly} />
            </div>

            {/* Action buttons — always shown when actionable */}
            {!isReadOnly && (forwardTargets.length > 0 || cancelTarget) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {pending && <Loader2 className="h-3 w-3 animate-spin text-[var(--muted)]" />}
                {forwardTargets.map((t) => (
                  <ActionBtn
                    key={t}
                    label={EU_BTN_LABELS[t] ?? t}
                    variant="primary"
                    disabled={pending}
                    onClick={() => requestStatusChange(t)}
                  />
                ))}
                {cancelTarget && (
                  <ActionBtn
                    label="Cancel order"
                    variant="danger-outline"
                    disabled={pending}
                    onClick={() => requestStatusChange(cancelTarget)}
                  />
                )}
              </div>
            )}

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
          riskyCancel={isRiskyCancel(pendingTarget)}
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

function ActionBtn({ label, variant, disabled, onClick }: {
  label: string;
  variant: "primary" | "secondary" | "danger-outline";
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
        variant === "danger-outline" &&
          "border border-status-danger-border/60 bg-status-danger-bg text-status-danger-fg hover:bg-status-danger-bg/80",
      )}
    >
      {label}
    </button>
  );
}
