import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/system";
import { ShipmentContents, type ShipmentContent } from "./shipment-contents";
import type { ShippableSubOrder } from "../create/create-shipment-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shipment · Trendslet Operations" };

// Same window the create form offers — orders that could be in a consignment.
const SHIPPABLE_STATUSES = [
  "purchased_online", "purchased_in_store", "under_review",
  "preparing_for_shipment", "shipped", "arrived_in_ksa", "delivered_to_warehouse",
];

export default async function ShipmentDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;

  const { data: shipment } = await sb
    .from("shipments")
    .select("id, tracking_number, status, shipment_type, origin, destination, shipped_at, delivered_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!shipment) notFound();

  const { data: links } = await sb
    .from("shipment_sub_orders")
    .select(`
      sub_order_id,
      sub_order:sub_orders (
        sub_order_number, product_title, status,
        order:orders ( customer:customers ( first_name, last_name, phone ) )
      )
    `)
    .eq("shipment_id", params.id);

  const { data: logs } = await sb
    .from("shipment_message_log")
    .select("sub_order_id, message_key, sent_at")
    .eq("shipment_id", params.id);

  const sentBySubOrder = new Map<string, Record<string, string>>();
  for (const l of (logs ?? []) as { sub_order_id: string; message_key: string; sent_at: string }[]) {
    const rec = sentBySubOrder.get(l.sub_order_id) ?? {};
    rec[l.message_key] = l.sent_at;
    sentBySubOrder.set(l.sub_order_id, rec);
  }

  const contents: ShipmentContent[] = ((links ?? []) as never[]).map((l) => {
    const r = l as unknown as {
      sub_order_id: string;
      sub_order: {
        sub_order_number: string; product_title: string | null; status: string;
        order: { customer: { first_name: string | null; last_name: string | null; phone: string | null } | null } | null;
      } | null;
    };
    const c = r.sub_order?.order?.customer;
    return {
      subOrderId: r.sub_order_id,
      subOrderNumber: r.sub_order?.sub_order_number ?? "—",
      productTitle: r.sub_order?.product_title ?? "—",
      customerName: [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim() || "—",
      hasPhone: Boolean(c?.phone),
      sent: sentBySubOrder.get(r.sub_order_id) ?? {},
    };
  }).sort((a, b) => a.subOrderNumber.localeCompare(b.subOrderNumber));

  const notifiable = contents.filter((c) => c.hasPhone).length;

  // Orders that could still be attached to this shipment.
  const { data: shippableRows } = await sb
    .from("sub_orders")
    .select("id, sub_order_number, product_title, status, order:orders(customer:customers(first_name, last_name, phone))")
    .in("status", SHIPPABLE_STATUSES)
    .order("sub_order_number", { ascending: false })
    .limit(300);

  const shippable: ShippableSubOrder[] = ((shippableRows ?? []) as never[]).map((row) => {
    const r = row as unknown as {
      id: string; sub_order_number: string; product_title: string | null; status: string;
      order: { customer: { first_name: string | null; last_name: string | null; phone: string | null } | null } | null;
    };
    return {
      id: r.id,
      subOrderNumber: r.sub_order_number,
      productTitle: r.product_title ?? "—",
      status: r.status,
      customerName: [r.order?.customer?.first_name, r.order?.customer?.last_name]
        .filter(Boolean).join(" ").trim() || "—",
      hasPhone: Boolean(r.order?.customer?.phone),
    };
  });

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-[var(--muted)]">
        <Link href="/shipments" className="hover:text-[var(--ink)]">Shipments</Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <span className="text-[var(--ink-2)]">{shipment.tracking_number}</span>
      </nav>

      <PageHeader
        title={shipment.tracking_number}
        subtitle={`${shipment.origin ?? "—"} → ${shipment.destination ?? "—"} · ${shipment.status ?? "unknown"}`}
      />

      <section className="flex flex-col gap-3">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Orders in this shipment — {contents.length}
          </h2>
          <span className="text-[12px] text-[var(--muted)]">
            {notifiable} of {contents.length} can be notified
          </span>
        </header>

        <ShipmentContents shipmentId={shipment.id} contents={contents} shippable={shippable} />

        <p className="text-[12px] text-[var(--muted)]">
          Updates send automatically as DHL moves the shipment. Use a button only when DHL is late,
          wrong, or silent — a message sent by hand will not be sent again by the scheduler.
        </p>
      </section>
    </div>
  );
}
