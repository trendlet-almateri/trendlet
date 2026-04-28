import { ShoppingBag } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/common/empty-state";
import { StatusPill } from "@/components/status/status-pill";
import { relativeTime } from "@/lib/utils/date";
import type { StatusCode } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sourcing queue · Trendslet Operations" };

const SOURCING_STATUSES: StatusCode[] = ["pending", "under_review", "in_progress"];

type Row = {
  id: string;
  sub_order_number: string;
  product_title: string;
  variant_title: string | null;
  brand_name_raw: string | null;
  quantity: number;
  status: string;
  is_at_risk: boolean;
  is_delayed: boolean;
  created_at: string;
  order: { shopify_order_number: string } | null;
  brand: { name: string } | null;
};

export default async function SourcingQueuePage() {
  const user = await requireRole(["sourcing", "fulfiller", "admin"]);
  const sb = createServiceClient();

  // Admin sees all sourcing-stage items; sourcing/fulfiller see only their assigned ones
  let q = sb
    .from("sub_orders")
    .select(`
      id, sub_order_number, product_title, variant_title, brand_name_raw, quantity, status,
      is_at_risk, is_delayed, created_at,
      order:orders ( shopify_order_number ),
      brand:brands ( name )
    `)
    .in("status", SOURCING_STATUSES)
    .order("created_at", { ascending: true })
    .limit(100);

  if (!user.roles.includes("admin")) {
    q = q.eq("assigned_employee_id", user.id);
  }

  const { data, error } = await q;
  if (error) console.error("[SourcingQueue]", error);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 text-ink-primary">Sourcing queue</h1>
        <span className="text-[12px] text-ink-tertiary">
          {rows.length} {rows.length === 1 ? "item" : "items"} to source
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Queue is empty"
          description="New orders flow into this queue. Mark items as purchased online or in-store, or flag as out of stock."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
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
                  {r.is_delayed && (
                    <span className="pill border border-status-danger-border/40 bg-status-danger-bg text-status-danger-fg">
                      Delayed
                    </span>
                  )}
                  {r.is_at_risk && !r.is_delayed && (
                    <span className="pill border border-status-sourcing-border/40 bg-status-sourcing-bg text-status-sourcing-fg">
                      SLA risk
                    </span>
                  )}
                </div>
                <div className="text-ink-primary">{r.product_title}</div>
                <div className="text-[11px] text-ink-tertiary">
                  Brand: {r.brand?.name ?? r.brand_name_raw ?? "—"} · qty {r.quantity}
                  {r.variant_title ? ` · ${r.variant_title}` : ""} · {r.order?.shopify_order_number}
                </div>
              </div>
              <span className="text-[11px] text-ink-tertiary">{relativeTime(r.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
