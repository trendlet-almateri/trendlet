"use client";

import { useState, useTransition } from "react";
import { Clock, Package, MoreHorizontal, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_BY_CODE, ROLE_STATUS_WHITELIST, type StatusCode } from "@/lib/constants";
import { relativeTime } from "@/lib/utils/date";
import type { FulfillmentRow } from "@/lib/queries/fulfillment";
import { setSubOrderStatusAction } from "@/app/(app)/fulfillment/actions";
import { ConfirmStatusModal } from "@/components/status/confirm-status-modal";
import { getNextStatuses, type Role } from "@/lib/workflow/sub-order-transitions";

// ─── Mock sourcing data (UI demo only — not persisted) ────────────────────────
const SUPPLIERS = ["Local agent", "Brand direct", "EU distributor", "US wholesale", "Marketplace"];
const NOTES = [
  "Brand replied — invoice pending.",
  "Second attempt — first supplier was OOS.",
  "Confirm size before purchase.",
  "Customer requested gift wrap.",
  null,
  null,
];
const CURRENCIES = ["EUR", "SAR", "USD", "AED"];
const MOCK_ASSIGNEES = [
  { name: "Ahmed",  initials: "AA" },
  { name: "Priya",  initials: "PS" },
  { name: "Kori",   initials: "KY" },
  { name: "Layla",  initials: "LH" },
  { name: "Fatima", initials: "FA" },
  { name: "Omar",   initials: "OM" },
];

function h(id: string) {
  let v = 0;
  for (let i = 0; i < id.length; i++) v = (v * 31 + id.charCodeAt(i)) >>> 0;
  return v;
}

function mockSourcing(row: FulfillmentRow) {
  const n = h(row.id);
  const brandSlug = (row.brand?.name ?? "brand").toLowerCase().replace(/[^a-z]/g, "");
  return {
    supplier: SUPPLIERS[n % SUPPLIERS.length],
    currency: CURRENCIES[(n >> 4) % CURRENCIES.length],
    cost: (((n >> 8) % 800) + 100 + ((n >> 16) % 99) / 100).toFixed(2),
    brandContact: `${brandSlug}@brand.cc`,
    note: NOTES[(n >> 12) % NOTES.length],
    assignee: MOCK_ASSIGNEES[(n >> 2) % MOCK_ASSIGNEES.length],
  };
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

// ─── Action button label overrides ────────────────────────────────────────────
const BTN_LABELS: Partial<Record<string, string>> = {
  in_progress:         "Start review",
  purchased_online:    "Purchased online",
  purchased_in_store:  "Purchased in-store",
  out_of_stock:        "Out of stock",
  delivered_to_warehouse: "Deliver to warehouse",
};

// ─── Props ─────────────────────────────────────────────────────────────────────
export type SourcingToast = {
  id: string;
  message: string;
  sub: string;
  kind: "info" | "success";
};

type Props = {
  row: FulfillmentRow;
  role: Role;
  isReadOnly: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onToast: (t: SourcingToast) => void;
  /** Name of the logged-in user (for employee rows where assignee = self) */
  selfName?: string;
  selfInitials?: string;
};

export function SourcingCard({
  row,
  role,
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

  const mock = mockSourcing(row);
  const isAdmin = role === "admin";
  const isUrgent = row.is_delayed || row.is_at_risk;
  const palette = STATUS_BY_CODE[optimisticStatus]?.palette ?? "pending";
  const statusLabel = STATUS_BY_CODE[optimisticStatus]?.label ?? optimisticStatus;

  // Assignee — for employees seeing own tasks use their info, else use mock
  const assignee = selfName
    ? { name: selfName, initials: selfInitials ?? selfName.slice(0, 2).toUpperCase() }
    : mock.assignee;

  // Determine action buttons
  const nextStatuses: StatusCode[] = isReadOnly ? [] : (() => {
    // For pending/assigned (To do tab): hardcode start + maybe cancel
    if (optimisticStatus === "pending" || optimisticStatus === "assigned") {
      const actions: StatusCode[] = ["in_progress"];
      if (isAdmin) actions.unshift("cancelled" as StatusCode);
      return actions;
    }
    return getNextStatuses(optimisticStatus, role, ROLE_STATUS_WHITELIST);
  })();

  const cancelTarget = nextStatuses.find((s) => s === "cancelled");
  const oosTarget = nextStatuses.find((s) => s === "out_of_stock");
  const forwardTargets = nextStatuses.filter((s) => s !== "cancelled" && s !== "out_of_stock");

  const advance = (target: StatusCode) => {
    setPendingTarget(null);
    const prev = optimisticStatus;
    setOptimisticStatus(target);
    startTransition(async () => {
      const result = await setSubOrderStatusAction({ subOrderId: row.id, status: target });
      const label = BTN_LABELS[target] ?? STATUS_BY_CODE[target]?.label ?? target;
      if (result.ok) {
        const isHandoff = target === "delivered_to_warehouse";
        onToast({
          id: `${row.id}-${Date.now()}`,
          message: isHandoff
            ? "Task completed"
            : `Status updated: ${label}`,
          sub: isHandoff
            ? `${row.order?.shopify_order_number ?? row.sub_order_number} → moved to Warehouse queue`
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
          isUrgent
            ? "border-red-200 bg-red-50/30"
            : "border-[var(--line)]",
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
              STATUS_PALETTE[palette] ?? STATUS_PALETTE.pending,
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
            {/* 3-dot menu for completed tab */}
            {isReadOnly && (
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
                    {isAdmin && (
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center px-3 py-1.5 text-[13px] text-[var(--ink)] hover:bg-[var(--hover)]"
                        onClick={() => setMenuOpen(false)}
                      >
                        Reassign
                      </button>
                    )}
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
            )}
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

          {/* ── Info rows (mock data) ── */}
          <div className="border-t border-[var(--line)] pt-2.5">
            <div className="flex flex-col gap-1.5">
              <InfoRow
                icon={<Package className="h-3 w-3 text-[var(--muted)]" />}
                label="Supplier"
                value={mock.supplier}
              />
              <InfoRow label="Target cost" value={`${mock.currency} ${mock.cost}`} />
              <InfoRow label="Brand contact" value={mock.brandContact} />
            </div>
          </div>

          {/* ── Note ── */}
          {mock.note && (
            <p className="border-t border-[var(--line)] pt-2 text-[12px] italic text-[var(--muted)]">
              {mock.note}
            </p>
          )}

          {/* ── Footer ── */}
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-2.5">
            <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
              <Clock className="h-3 w-3 shrink-0" aria-hidden />
              <span>{relativeTime(row.status_changed_at)}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[9px] font-semibold text-[var(--accent)]">
                  {assignee.initials}
                </span>
                {assignee.name}
              </span>
            </div>

            {/* Action buttons — visible only when selected */}
            {isSelected && !isReadOnly && (
              <div className="flex flex-wrap items-center gap-1.5">
                {pending && <Loader2 className="h-3 w-3 animate-spin text-[var(--muted)]" />}
                {oosTarget && (
                  <ActionBtn
                    label="Out of stock"
                    variant="danger-outline"
                    disabled={pending}
                    onClick={() => setPendingTarget(oosTarget)}
                  />
                )}
                {cancelTarget && (
                  <ActionBtn
                    label="Cancel order"
                    variant="danger-outline"
                    disabled={pending}
                    onClick={() => setPendingTarget(cancelTarget)}
                  />
                )}
                {forwardTargets.map((t) => (
                  <ActionBtn
                    key={t}
                    label={BTN_LABELS[t] ?? STATUS_BY_CODE[t]?.label ?? t}
                    variant={t === forwardTargets[forwardTargets.length - 1] ? "primary" : "secondary"}
                    disabled={pending}
                    onClick={() => setPendingTarget(t)}
                  />
                ))}
              </div>
            )}

            {/* Completed tab: show current status as italic text */}
            {isReadOnly && (
              <span className="text-[11px] italic text-[var(--muted)]">{statusLabel}</span>
            )}
          </footer>
        </div>
      </article>

      {/* Confirm modal */}
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
        variant === "danger-outline" && "border border-red-300 text-red-600 hover:bg-red-50",
      )}
    >
      {label}
    </button>
  );
}
