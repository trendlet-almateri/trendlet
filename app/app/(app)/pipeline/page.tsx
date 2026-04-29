import { Warehouse } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/common/empty-state";
import { StatusPill } from "@/components/status/status-pill";
import { relativeTime } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

export const metadata = { title: "Warehouse pipeline · Trendslet Operations" };

const WAREHOUSE_STATUSES = ["delivered_to_warehouse", "preparing_for_shipment", "shipped"] as const;

type Row = {
  id: string;
  sub_order_number: string;
  product_title: string;
  brand_name_raw: string | null;
  quantity: number;
  status: string;
  status_changed_at: string;
  order: { shopify_order_number: string } | null;
  brand: { name: string } | null;
};

export default async function WarehousePipelinePage() {
  const user = await requireRole(["warehouse", "admin"]);
  const sb = createServiceClient();

  let q = sb
    .from("sub_orders")
    .select(`
      id, sub_order_number, product_title, brand_name_raw, quantity, status, status_changed_at,
      order:orders ( shopify_order_number ),
      brand:brands ( name )
    `)
    .in("status", WAREHOUSE_STATUSES as unknown as string[])
    .order("status_changed_at", { ascending: false })
    .limit(150);

  if (!user.roles.includes("admin")) q = q.eq("assigned_employee_id", user.id);

  const { data, error } = await q;
  if (error) console.error("[WarehousePipeline]", error);
  const rows = (data ?? []) as unknown as Row[];

  // Group by status (kanban-lite)
  const byStatus = new Map<string, Row[]>();
  for (const status of WAREHOUSE_STATUSES) byStatus.set(status, []);
  for (const r of rows) {
    const list = byStatus.get(r.status);
    if (list) list.push(r);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 text-ink-primary">Warehouse pipeline</h1>
        <span className="text-[12px] text-ink-tertiary">
          {rows.length} {rows.length === 1 ? "item" : "items"} in flight
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="Nothing in the warehouse"
          description="Items appear here once sourcing marks them as purchased and they arrive at the warehouse."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {(WAREHOUSE_STATUSES as readonly string[]).map((status) => {
            const items = byStatus.get(status) ?? [];
            return (
              <section key={status} className="flex flex-col gap-2 rounded-md border border-hairline bg-surface p-3">
                <div className="flex items-center justify-between">
                  <StatusPill status={status} />
                  <span className="text-[11px] tabular-nums text-ink-tertiary">{items.length}</span>
                </div>
                <ul className="flex flex-col gap-2">
                  {items.length === 0 && (
                    <li className="rounded-sm border border-dashed border-hairline px-3 py-4 text-center text-[11px] text-ink-tertiary">
                      Empty
                    </li>
                  )}
                  {items.map((r) => (
                    <li key={r.id} className="rounded-sm border border-hairline px-3 py-2">
                      <div className="text-[11px] font-medium uppercase tracking-[0.4px] text-ink-tertiary">
                        {r.sub_order_number}
                      </div>
                      <div className="text-[13px] text-ink-primary">{r.product_title}</div>
                      <div className="mt-0.5 text-[11px] text-ink-tertiary">
                        {r.brand?.name ?? r.brand_name_raw ?? "—"} · qty {r.quantity} · {relativeTime(r.status_changed_at)}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
