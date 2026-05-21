"use client";

import * as React from "react";
import { X, ChevronRight, MapPin, Mail, Phone, Package, Clock, AlertCircle, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { shortDate, fullDateTime } from "@/lib/utils/date";
import { StatusPill } from "@/components/status/status-pill";
import { deriveOrderCancelState } from "@/lib/workflow/order-cancel-state";
import type { OrderRow } from "@/lib/queries/orders";

// ── Full detail types ─────────────────────────────────────────────────────────

type FullOrder = {
  id: string;
  shopify_order_id: string;
  shopify_order_number: string;
  shopify_created_at: string;
  total: number | null;
  subtotal: number | null;
  currency: string;
  notes: string | null;
  shipping_address: {
    address1?: string | null;
    city?: string | null;
    zip?: string | null;
    country?: string | null;
  } | null;
  customer: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  sub_orders: {
    id: string;
    sub_order_number: string;
    product_title: string;
    variant_title: string | null;
    sku: string | null;
    quantity: number;
    unit_price: number | null;
    currency: string;
    status: string;
    is_unassigned: boolean;
    is_delayed: boolean;
    is_at_risk: boolean;
    brand_name_raw: string | null;
    product_image_url: string | null;
  }[];
};

type HistoryRow = {
  id: string;
  sub_order_id: string;
  from_status: string | null;
  to_status: string;
  notes: string | null;
  created_at: string;
};

type EventRow = {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  description: string | null;
  created_at: string;
};

// Unified timeline entry
type TimelineEntry =
  | { kind: "event"; data: EventRow }
  | { kind: "status"; data: HistoryRow; sub_order_number: string | undefined };

const SEVERITY_ICON = {
  critical: AlertCircle,
  warning:  AlertTriangle,
  info:     Info,
  success:  CheckCircle,
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-[var(--rose)]",
  warning:  "text-[var(--amber)]",
  info:     "text-[var(--blue,#60a5fa)]",
  success:  "text-[var(--green)]",
};

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  order: OrderRow | null;
  onClose: () => void;
  compact?: boolean;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function OrderDrawer({ order, onClose, compact = false }: Props) {
  const [tab, setTab] = React.useState<"overview" | "items" | "timeline">("overview");
  const [visible, setVisible] = React.useState(false);
  const [full, setFull] = React.useState<FullOrder | null>(null);
  const [history, setHistory] = React.useState<HistoryRow[]>([]);
  const [events, setEvents] = React.useState<EventRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Animate in + fetch full data when order changes
  React.useEffect(() => {
    if (!order) return;
    setVisible(true);
    setTab("overview");
    setFull(null);
    setHistory([]);
    setEvents([]);
    setLoading(true);

    (async () => {
      const res = await fetch(`/api/orders/${order.id}`);
      if (res.ok) {
        const json = await res.json();
        setFull(json.order as FullOrder);
        setHistory((json.history ?? []) as HistoryRow[]);
        setEvents((json.events ?? []) as EventRow[]);
      }
      setLoading(false);
    })();
  }, [order]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 220);
  }

  React.useEffect(() => {
    if (!order) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [order]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!order) return null;

  const o = full ?? order;
  const customerName = o.customer
    ? [o.customer.first_name, o.customer.last_name].filter(Boolean).join(" ") || "—"
    : "—";
  const cancelState   = deriveOrderCancelState(order.sub_orders);
  const isCancelled   = cancelState === "all";
  const isPartialCancelled = cancelState === "partial";
  // A cancelled order's Delayed/On-track state is meaningless — suppress it.
  const hasDelayed    = !isCancelled && order.sub_orders.some((s) => s.is_delayed);
  const hasUnassigned = !isCancelled && order.sub_orders.some((s) => s.is_unassigned);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{
          backgroundColor: visible ? "rgba(20,22,28,0.35)" : "rgba(20,22,28,0)",
          transition: "background-color 0.25s ease",
        }}
        onClick={handleClose}
        aria-hidden
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal
        aria-label={`Order ${order.shopify_order_number} details`}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-[var(--panel)] shadow-[var(--shadow-md)]",
          compact ? "md:w-[480px]" : "md:w-[560px]",
        )}
        style={{
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(.32,.72,.32,1)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--line)] px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-jetbrains,_monospace)] text-[15px] font-semibold text-[var(--ink)] tabular-nums">
                {order.shopify_order_number}
              </span>
              <span className="text-[var(--muted)]">·</span>
              <span className="text-[14px] font-medium text-[var(--ink-2)]">{customerName}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {isCancelled && (
                <span className="rounded-full bg-[var(--rose-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--rose)]">Cancelled</span>
              )}
              {isPartialCancelled && (
                <span className="rounded-full bg-[var(--rose-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--rose)]">Partially cancelled</span>
              )}
              {hasDelayed && (
                <span className="rounded-full bg-[var(--rose-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--rose)]">Delayed</span>
              )}
              {hasUnassigned && (
                <span className="rounded-full bg-[var(--amber-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--amber)]">Unassigned</span>
              )}
              {!isCancelled && !isPartialCancelled && !hasDelayed && !hasUnassigned && (
                <span className="rounded-full bg-[var(--green-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--green)]">On track</span>
              )}
              <span className="rounded-full bg-[var(--slate-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--slate)]">
                {order.sub_orders.length} sub-orders
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-px border-b border-[var(--line)] bg-[var(--line)]">
          {[
            { label: "Total",      value: formatCurrency(o.total ?? 0, o.currency) },
            { label: "Placed",     value: shortDate(order.shopify_created_at) },
            { label: "Sub-orders", value: String(order.sub_orders.length) },
          ].map((s) => (
            <div key={s.label} className="flex flex-col gap-0.5 bg-[var(--panel)] px-4 py-3">
              <span className="text-[10px] uppercase tracking-[0.4px] text-[var(--muted)]">{s.label}</span>
              <span className="font-[family-name:var(--font-jetbrains,_monospace)] text-[15px] font-semibold tabular-nums text-[var(--ink)]">
                {s.value}
              </span>
            </div>
          ))}
        </div>

        {/* Tabs — hidden in compact mode */}
        {!compact && (
          <div className="flex gap-0 border-b border-[var(--line)] px-5">
            {(["overview", "items", "timeline"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "border-b-2 px-3 py-2.5 text-[12px] font-medium capitalize transition-colors",
                  tab === t
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]",
                )}
              >
                {t === "items" ? "Items" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-12 text-[13px] text-[var(--muted)]">
              Loading…
            </div>
          )}

          {!loading && (compact || tab === "overview") && (
            <div className="flex flex-col gap-4">

              {/* Customer */}
              <Section label="Customer">
                <Row label="Name" value={customerName} />
                {(full?.customer?.email) && (
                  <Row label={<Mail className="h-3.5 w-3.5" />} value={full.customer.email} mono />
                )}
                {(full?.customer?.phone) && (
                  <Row label={<Phone className="h-3.5 w-3.5" />} value={full.customer.phone} mono />
                )}
              </Section>

              {/* Shipping address */}
              {full?.shipping_address && (
                <Section label={<><MapPin className="h-3.5 w-3.5" />Ship to</>}>
                  {full.shipping_address.address1 && (
                    <Row label="Address" value={full.shipping_address.address1} />
                  )}
                  {(full.shipping_address.city || full.shipping_address.zip) && (
                    <Row
                      label="City"
                      value={[full.shipping_address.city, full.shipping_address.zip].filter(Boolean).join(" · ")}
                    />
                  )}
                  {full.shipping_address.country && (
                    <Row label="Country" value={full.shipping_address.country} />
                  )}
                </Section>
              )}

              {/* Totals */}
              <Section label="Totals">
                <Row label="Subtotal" value={formatCurrency(full?.subtotal ?? order.total ?? 0, o.currency)} mono />
                <div className="border-t border-[var(--line)] pt-2">
                  <Row label="Total" value={formatCurrency(o.total ?? 0, o.currency)} mono bold />
                </div>
              </Section>

              {/* Notes */}
              {full?.notes && (
                <Section label="Notes">
                  <p className="text-[13px] text-[var(--ink-2)]">{full.notes}</p>
                </Section>
              )}

              {/* Meta */}
              <Section label="Order info">
                <Row label="Shopify ID" value={full?.shopify_order_id ?? "—"} mono />
                <Row label="Created" value={fullDateTime(order.shopify_created_at)} />
              </Section>
            </div>
          )}

          {!loading && !compact && tab === "items" && (
            <div className="flex flex-col gap-2">
              {(full?.sub_orders ?? []).map((so) => {
                const lineTotal = so.unit_price != null ? so.unit_price * so.quantity : null;
                return (
                  <div
                    key={so.id}
                    className={cn(
                      "flex gap-3 rounded-[var(--radius)] border bg-[var(--panel)] p-3",
                      so.is_unassigned ? "border-[var(--rose)]/30 bg-[var(--rose-bg)]/10" : "border-[var(--line)]",
                    )}
                  >
                    {/* Image */}
                    {"product_image_url" in so && so.product_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={so.product_image_url}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-md border border-[var(--line)] object-cover"
                      />
                    ) : (
                      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-md border border-[var(--line)] bg-[var(--hover)]">
                        <Package className="h-5 w-5 text-[var(--muted-2)]" aria-hidden />
                      </span>
                    )}

                    {/* Details */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[13px] font-medium text-[var(--ink)] leading-snug">
                          {so.product_title}
                        </span>
                        <span className="shrink-0 font-[family-name:var(--font-jetbrains,_monospace)] text-[13px] font-semibold tabular-nums text-[var(--ink)]">
                          {lineTotal != null ? formatCurrency(lineTotal, so.currency) : "—"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--muted)]">
                        {so.brand_name_raw && <span>{so.brand_name_raw}</span>}
                        {"variant_title" in so && so.variant_title && (
                          <><span>·</span><span>{so.variant_title}</span></>
                        )}
                        {"sku" in so && so.sku && (
                          <><span>·</span><span className="font-[family-name:var(--font-jetbrains,_monospace)] tabular-nums">{so.sku}</span></>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <StatusPill status={so.status} isUnassigned={so.is_unassigned} />
                          {so.is_delayed && (
                            <span className="rounded-full bg-[var(--rose-bg)] px-1.5 py-px text-[10px] font-semibold text-[var(--rose)]">Delayed</span>
                          )}
                          {so.is_at_risk && !so.is_delayed && (
                            <span className="rounded-full bg-[var(--amber-bg)] px-1.5 py-px text-[10px] font-semibold text-[var(--amber)]">SLA risk</span>
                          )}
                        </div>
                        <span className="text-[11px] text-[var(--muted)]">
                          {so.unit_price != null ? formatCurrency(so.unit_price, so.currency) : "—"} × {so.quantity}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && !compact && tab === "timeline" && (() => {
            // Merge Shopify events + sub-order status changes into one feed
            const entries: TimelineEntry[] = [
              ...events.map((e): TimelineEntry => ({ kind: "event", data: e })),
              ...history.map((h): TimelineEntry => ({
                kind: "status",
                data: h,
                sub_order_number: full?.sub_orders.find((s) => s.id === h.sub_order_id)?.sub_order_number,
              })),
            ].sort((a, b) => {
              const ta = a.kind === "event" ? a.data.created_at : a.data.created_at;
              const tb = b.kind === "event" ? b.data.created_at : b.data.created_at;
              return tb.localeCompare(ta); // newest first
            });

            // Baseline entry from order creation date if nothing else exists
            const baseline = full?.shopify_created_at ?? order.shopify_created_at;

            return (
              <div className="flex flex-col gap-2">
                {entries.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8 text-[13px] text-[var(--muted)]">
                    <Clock className="h-8 w-8 opacity-30" aria-hidden />
                    No events recorded yet
                  </div>
                )}

                {entries.map((entry) => {
                  if (entry.kind === "event") {
                    const e = entry.data;
                    const Icon = SEVERITY_ICON[e.severity] ?? Info;
                    return (
                      <div key={e.id} className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
                        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", SEVERITY_COLOR[e.severity])} aria-hidden />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-[13px] font-medium text-[var(--ink)]">{e.title}</span>
                          {e.description && (
                            <span className="text-[12px] text-[var(--muted)]">{e.description}</span>
                          )}
                          <span className="text-[11px] text-[var(--muted)]">{fullDateTime(e.created_at)}</span>
                        </div>
                      </div>
                    );
                  }

                  // status history entry
                  const h = entry.data;
                  return (
                    <div key={h.id} className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[12px]">
                      <span className="font-[family-name:var(--font-jetbrains,_monospace)] text-[11px] font-medium tabular-nums text-[var(--muted)]">
                        {entry.sub_order_number ?? h.sub_order_id.slice(0, 8)}
                      </span>
                      {h.from_status && (
                        <>
                          <StatusPill status={h.from_status} />
                          <ChevronRight className="h-3 w-3 text-[var(--muted)]" aria-hidden />
                        </>
                      )}
                      <StatusPill status={h.to_status} />
                      <span className="ml-auto text-[11px] text-[var(--muted)]">{fullDateTime(h.created_at)}</span>
                      {h.notes && <span className="basis-full text-[12px] text-[var(--ink-2)]">{h.notes}</span>}
                    </div>
                  );
                })}

                {/* Baseline: order placed */}
                <div className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--hover)] px-3 py-2.5 opacity-60">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium text-[var(--ink)]">Order placed on Shopify</span>
                    <span className="text-[11px] text-[var(--muted)]">{fullDateTime(baseline)}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Compact footer — "Open full order" CTA */}
        {compact && order && (
          <div className="shrink-0 border-t border-[var(--line)] bg-[var(--hover)] px-5 py-3">
            <a
              href={`/orders/${order.id}`}
              className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[12px] font-medium text-[var(--accent)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--hover)]"
            >
              <span>Open full order</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        )}
      </div>
    </>
  );
}

// ── Small layout helpers ──────────────────────────────────────────────────────

function Section({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--hover)] p-4">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.4px] text-[var(--muted)]">
        {label}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  bold,
}: {
  label: React.ReactNode;
  value: string;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="flex items-center gap-1 text-[var(--muted)]">{label}</span>
      <span
        className={cn(
          "text-right text-[var(--ink)]",
          mono && "font-[family-name:var(--font-jetbrains,_monospace)] tabular-nums",
          bold && "font-semibold",
        )}
      >
        {value}
      </span>
    </div>
  );
}
