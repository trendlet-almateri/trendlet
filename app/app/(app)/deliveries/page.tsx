import { MapPin } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/common/empty-state";
import { StatusPill } from "@/components/status/status-pill";
import { DeliveryActions } from "@/components/deliveries/delivery-actions";
import { relativeTime } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

export const metadata = { title: "KSA last-mile · Trendslet Operations" };

const KSA_STATUSES = ["arrived_in_ksa", "out_for_delivery", "delivered"] as const;

type Row = {
  id: string;
  sub_order_number: string;
  product_title: string;
  status: string;
  status_changed_at: string;
  order: {
    shopify_order_number: string;
    shipping_address: { city?: string; address1?: string } | null;
    customer: { first_name: string | null; last_name: string | null; phone: string | null } | null;
  } | null;
};

export default async function DeliveriesPage() {
  const user = await requireRole(["ksa_operator", "admin"]);
  const sb = createServiceClient();

  let q = sb
    .from("sub_orders")
    .select(`
      id, sub_order_number, product_title, status, status_changed_at,
      order:orders ( shopify_order_number, shipping_address, customer:customers ( first_name, last_name, phone ) )
    `)
    .in("status", KSA_STATUSES as unknown as string[])
    .order("status_changed_at", { ascending: false })
    .limit(100);

  if (!user.roles.includes("admin")) q = q.eq("assigned_employee_id", user.id);

  const { data, error } = await q;
  if (error) console.error("[DeliveriesPage]", error);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 text-ink-primary">KSA last-mile</h1>
        <span className="text-[12px] text-ink-tertiary">
          {rows.length} {rows.length === 1 ? "delivery" : "deliveries"} in KSA
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No deliveries in KSA"
          description="Items appear here after they arrive in KSA. Last-mile operators dispatch and confirm delivery from this view."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const customerName = r.order?.customer
              ? [r.order.customer.first_name, r.order.customer.last_name].filter(Boolean).join(" ")
              : "—";
            const city = r.order?.shipping_address?.city ?? "";
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-hairline bg-surface p-4"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-[0.4px] text-ink-tertiary">
                      {r.sub_order_number}
                    </span>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="text-ink-primary">{r.product_title}</div>
                  <div className="text-[11px] text-ink-tertiary">
                    {customerName}
                    {city ? ` · ${city}` : ""}
                    {r.order?.customer?.phone ? ` · ${r.order.customer.phone}` : ""}
                    {" · "}
                    {r.order?.shopify_order_number}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-[11px] text-ink-tertiary">{relativeTime(r.status_changed_at)}</span>
                  <DeliveryActions subOrderId={r.id} currentStatus={r.status} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
