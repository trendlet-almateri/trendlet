"use client";

import * as React from "react";
import { X, ChevronRight, MapPin, Mail, Phone, Package, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { shortDate, fullDateTime } from "@/lib/utils/date";
import { StatusPill } from "@/components/status/status-pill";
import { createClient } from "@/lib/supabase/client";
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

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  order: OrderRow | null;
  onClose: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function OrderDrawer({ order, onClose }: Props) {
  const [tab, setTab] = React.useState<"overview" | "items" | "timeline">("overview");
  const [visible, setVisible] = React.useState(false);
  const [full, setFull] = React.useState<FullOrder | null>(null);
  const [history, setHistory] = React.useState<HistoryRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Animate in + fetch full data when order changes
  React.useEffect(() => {
    if (!order) return;
    setVisible(true);
    setTab("overview");
    setFull(null);
    setHistory([]);
    setLoading(true);

    const sb = createClient();

    (async () => {
      const { data } = await sb
        .from("orders")
        .select(`
          id, shopify_order_id, shopify_order_number, shopify_created_at,
          total, subtotal, currency, notes, shipping_address,
          customer:customers ( first_name, last_name, email, phone ),
          sub_orders (
            id, sub_order_number, product_title, variant_title, sku,
            quantity, unit_price, currency, status,
            is_unassigned, is_delayed, is_at_risk,
            brand_name_raw, product_image_url
          )
        `)
        .eq("id", order.id)
        .maybeSingle();

      const fullOrder = data as unknown as FullOrder | null;
      setFull(fullOrder);

      if (fullOrder?.sub_orders?.length) {
        const ids = fullOrder.sub_orders.map((s) => s.id);
        const { data: hist } = await sb
          .from("status_history")
          .select("id, sub_order_id, from_status, to_status, notes, created_at")
          .in("sub_order_id", ids)
          .order("created_at", { ascending: false })
          .limit(50);
        setHistory((hist ?? []) as unknown as HistoryRow[]);
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
  const hasDelayed    = order.sub_orders.some((s) => s.is_delayed);
  const hasUnassigned = order.sub_orders.some((s) => s.is_unassigned);

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
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-[var(--panel)] shadow-[var(--shadow-md)] md:w-[560px]"
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
              {hasDelayed && (
                <span className="rounded-full bg-[var(--rose-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--rose)]">Delayed</span>
              )}
              {hasUnassigned && (
                <span className="rounded-full bg-[var(--amber-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--amber)]">Unassigned</span>
              )}
              {!hasDelayed && !hasUnassigned && (
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

        {/* Tabs */}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-12 text-[13px] text-[var(--muted)]">
              Loading…
            </div>
          )}

          {!loading && tab === "overview" && (
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

          {!loading && tab === "items" && (
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

          {!loading && tab === "timeline" && (
            <div className="flex flex-col gap-2">
              {history.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-[13px] text-[var(--muted)]">
                  <Clock className="h-8 w-8 opacity-30" aria-hidden />
                  No status history yet
                </div>
              ) : (
                history.map((h) => {
                  const sub = (full?.sub_orders ?? []).find((s) => s.id === h.sub_order_id);
                  return (
                    <div
                      key={h.id}
                      className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12px]"
                    >
                      <span className="font-[family-name:var(--font-jetbrains,_monospace)] text-[11px] font-medium tabular-nums text-[var(--muted)]">
                        {sub?.sub_order_number ?? h.sub_order_id.slice(0, 8)}
                      </span>
                      {h.from_status && (
                        <>
                          <StatusPill status={h.from_status} />
                          <ChevronRight className="h-3 w-3 text-[var(--muted)]" aria-hidden />
                        </>
                      )}
                      <StatusPill status={h.to_status} />
                      <span className="ml-auto text-[11px] text-[var(--muted)]">
                        {fullDateTime(h.created_at)}
                      </span>
                      {h.notes && (
                        <span className="basis-full text-[12px] text-[var(--ink-2)]">{h.notes}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
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
