import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/status/status-pill";
import { formatCurrency } from "@/lib/utils/currency";
import { fullDateTime, shortDate } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

type OrderDetail = {
  id: string;
  shopify_order_id: string;
  shopify_order_number: string;
  shopify_created_at: string;
  total: number | null;
  subtotal: number | null;
  currency: string;
  shipping_address: { city?: string; country?: string; address1?: string; zip?: string } | null;
  notes: string | null;
  customer: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    language_pref: string | null;
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
    is_at_risk: boolean;
    is_delayed: boolean;
    brand_name_raw: string | null;
    brand: { id: string; name: string } | null;
  }[];
};

type StatusHistoryRow = {
  id: string;
  sub_order_id: string;
  from_status: string | null;
  to_status: string;
  notes: string | null;
  created_at: string;
};

export async function generateMetadata({ params }: { params: { id: string } }) {
  const sb = createServiceClient();
  const { data } = await sb
    .from("orders")
    .select("shopify_order_number")
    .eq("id", params.id)
    .maybeSingle();
  const num = (data as { shopify_order_number?: string } | null)?.shopify_order_number;
  return { title: num ? `${num} · Trendslet Operations` : "Order · Trendslet Operations" };
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const sb = createServiceClient();

  const { data: orderData, error } = await sb
    .from("orders")
    .select(`
      id, shopify_order_id, shopify_order_number, shopify_created_at,
      total, subtotal, currency, shipping_address, notes,
      customer:customers ( first_name, last_name, email, phone, language_pref ),
      sub_orders (
        id, sub_order_number, product_title, variant_title, sku,
        quantity, unit_price, currency, status,
        is_unassigned, is_at_risk, is_delayed, brand_name_raw,
        brand:brands ( id, name )
      )
    `)
    .eq("id", params.id)
    .maybeSingle();

  if (error || !orderData) {
    notFound();
  }

  const order = orderData as unknown as OrderDetail;

  // Status history for all sub-orders in this order
  const subOrderIds = order.sub_orders.map((s) => s.id);
  const { data: historyData } = subOrderIds.length
    ? await sb
        .from("status_history")
        .select("id, sub_order_id, from_status, to_status, notes, created_at")
        .in("sub_order_id", subOrderIds)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };
  const history = (historyData ?? []) as unknown as StatusHistoryRow[];

  const customerName = order.customer
    ? [order.customer.first_name, order.customer.last_name].filter(Boolean).join(" ") || "Guest"
    : "Guest";

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-ink-tertiary">
        <Link href="/orders" className="hover:text-ink-primary">
          Orders
        </Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <span className="text-ink-secondary">{order.shopify_order_number}</span>
      </nav>

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 text-ink-primary">{order.shopify_order_number}</h1>
          <span className="text-[12px] text-ink-tertiary">
            Placed {fullDateTime(order.shopify_created_at)}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Total</span>
          <span className="text-[20px] font-medium tabular-nums text-ink-primary">
            {formatCurrency(order.total ?? 0, order.currency)}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        {/* Main column */}
        <div className="flex flex-col gap-4">
          {/* Sub-orders */}
          <section className="flex flex-col gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Sub-orders ({order.sub_orders.length})
            </h2>
            <div className="flex flex-col gap-2">
              {order.sub_orders.map((s) => {
                const lineTotal = s.unit_price != null ? s.unit_price * s.quantity : null;
                const brandName = s.brand?.name ?? s.brand_name_raw ?? "—";
                return (
                  <article
                    key={s.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.4px] text-ink-tertiary">
                          {s.sub_order_number}
                        </span>
                        <StatusPill status={s.status} isUnassigned={s.is_unassigned} />
                        {s.is_delayed && (
                          <span className="pill border border-status-danger-border/40 bg-status-danger-bg text-status-danger-fg">
                            Delayed
                          </span>
                        )}
                        {s.is_at_risk && !s.is_delayed && (
                          <span className="pill border border-status-sourcing-border/40 bg-status-sourcing-bg text-status-sourcing-fg">
                            SLA risk
                          </span>
                        )}
                      </div>
                      <div className="text-ink-primary">{s.product_title}</div>
                      <div className="text-[11px] text-ink-tertiary">
                        Brand: {brandName}
                        {s.sku && <> · SKU: {s.sku}</>}
                        {s.variant_title && <> · {s.variant_title}</>}
                        {" · "}qty {s.quantity}
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      {lineTotal != null ? (
                        <>
                          <div className="text-ink-primary">{formatCurrency(lineTotal, s.currency)}</div>
                          <div className="text-[11px] text-ink-tertiary">
                            {formatCurrency(s.unit_price ?? 0, s.currency)} ea
                          </div>
                        </>
                      ) : (
                        <span className="text-ink-tertiary">—</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Status history */}
          {history.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Status history</h2>
              <ul className="flex flex-col gap-2">
                {history.map((h) => {
                  const sub = order.sub_orders.find((s) => s.id === h.sub_order_id);
                  return (
                    <li
                      key={h.id}
                      className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12px] shadow-[var(--shadow-sm)]"
                    >
                      <span className="text-[11px] font-medium uppercase tracking-[0.4px] text-ink-tertiary">
                        {sub?.sub_order_number ?? h.sub_order_id.slice(0, 8)}
                      </span>
                      {h.from_status && (
                        <>
                          <StatusPill status={h.from_status} />
                          <ChevronRight className="h-3 w-3 text-ink-tertiary" aria-hidden />
                        </>
                      )}
                      <StatusPill status={h.to_status} />
                      <span className="ml-auto text-[11px] text-ink-tertiary">
                        {fullDateTime(h.created_at)}
                      </span>
                      {h.notes && (
                        <span className="basis-full text-[12px] text-ink-secondary">{h.notes}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        {/* Right rail */}
        <aside className="flex flex-col gap-4">
          {/* Customer */}
          <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Customer</h2>
            <div className="flex flex-col gap-1 text-[13px]">
              <span className="font-medium text-ink-primary">{customerName}</span>
              {order.customer?.email && (
                <span className="text-ink-secondary">{order.customer.email}</span>
              )}
              {order.customer?.phone && (
                <span className="text-ink-secondary tabular-nums">{order.customer.phone}</span>
              )}
              {order.customer?.language_pref && (
                <span className="text-[11px] uppercase tracking-[0.4px] text-ink-tertiary">
                  Prefers {order.customer.language_pref.toUpperCase()}
                </span>
              )}
            </div>
          </section>

          {/* Shipping */}
          {order.shipping_address && (
            <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Ship to</h2>
              <div className="flex flex-col gap-0.5 text-[13px] text-ink-secondary">
                {order.shipping_address.address1 && <span>{order.shipping_address.address1}</span>}
                {(order.shipping_address.city || order.shipping_address.zip) && (
                  <span>
                    {order.shipping_address.city}
                    {order.shipping_address.zip ? ` · ${order.shipping_address.zip}` : ""}
                  </span>
                )}
                {order.shipping_address.country && <span>{order.shipping_address.country}</span>}
              </div>
            </section>
          )}

          {/* Totals */}
          <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Totals</h2>
            <dl className="flex flex-col gap-1 text-[13px]">
              <div className="flex items-center justify-between">
                <dt className="text-ink-secondary">Subtotal</dt>
                <dd className="tabular-nums text-ink-primary">
                  {formatCurrency(order.subtotal ?? 0, order.currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--line)] pt-2">
                <dt className="font-medium text-ink-primary">Total</dt>
                <dd className="tabular-nums font-medium text-ink-primary">
                  {formatCurrency(order.total ?? 0, order.currency)}
                </dd>
              </div>
            </dl>
          </section>

          {/* Meta */}
          <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 text-[12px] text-[var(--muted)] shadow-[var(--shadow-sm)]">
            <div>Order ID: <span className="tabular-nums">{order.shopify_order_id}</span></div>
            <div>Created: {shortDate(order.shopify_created_at)}</div>
          </section>
        </aside>
      </div>
    </div>
  );
}
