import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Check, Clock } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/system";
import { MESSAGE_LABELS } from "@/lib/shipping/dhl-customer-messages";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shipment · Trendslet Operations" };

type Content = {
  subOrderId: string;
  subOrderNumber: string;
  productTitle: string;
  status: string;
  customerName: string;
  phone: string | null;
  sent: { key: string; at: string }[];
};

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

  const sentBySubOrder = new Map<string, { key: string; at: string }[]>();
  for (const l of (logs ?? []) as { sub_order_id: string; message_key: string; sent_at: string }[]) {
    const arr = sentBySubOrder.get(l.sub_order_id) ?? [];
    arr.push({ key: l.message_key, at: l.sent_at });
    sentBySubOrder.set(l.sub_order_id, arr);
  }

  const contents: Content[] = ((links ?? []) as never[]).map((l) => {
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
      status: r.sub_order?.status ?? "—",
      customerName: [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim() || "—",
      phone: c?.phone ?? null,
      sent: sentBySubOrder.get(r.sub_order_id) ?? [],
    };
  }).sort((a, b) => a.subOrderNumber.localeCompare(b.subOrderNumber));

  const notifiable = contents.filter((c) => c.phone).length;

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

      <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
        <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Orders in this shipment — {contents.length}
          </h2>
          <span className="text-[12px] text-[var(--muted)]">
            {notifiable} of {contents.length} can be notified
          </span>
        </header>

        {contents.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-[var(--muted)]">
            No orders recorded for this shipment, so no customer updates will be sent. Orders are
            attached when the shipment is created.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-[var(--line)] text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th className="px-4 py-2 font-medium">Sub-order</th>
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Updates sent</th>
                </tr>
              </thead>
              <tbody>
                {contents.map((c) => (
                  <tr key={c.subOrderId} className="border-b border-[var(--line)] last:border-b-0">
                    <td className="px-4 py-3 font-mono text-[12px] text-[var(--ink)]">{c.subOrderNumber}</td>
                    <td className="px-4 py-3 text-[13px] text-[var(--ink)]">{c.productTitle}</td>
                    <td className="px-4 py-3 text-[13px] text-[var(--muted)]">
                      {c.customerName}
                      {!c.phone && <span className="ml-2 text-[11px] text-[var(--amber)]">no phone</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.sent.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[12px] text-[var(--muted)]">
                          <Clock className="size-3.5" /> none yet
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {c.sent.map((s) => (
                            <span
                              key={s.key}
                              title={new Date(s.at).toLocaleString()}
                              className="inline-flex items-center gap-1 rounded-full border border-[var(--green)]/30 bg-[var(--green-bg)] px-2 py-0.5 text-[11px] text-[var(--green)]"
                            >
                              <Check className="size-3" />
                              {MESSAGE_LABELS[s.key as keyof typeof MESSAGE_LABELS] ?? s.key}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
