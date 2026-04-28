import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/common/empty-state";
import { AutoAssignButton } from "./auto-assign-button";
import { formatCurrency } from "@/lib/utils/currency";
import { relativeTime } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

export const metadata = { title: "Unassigned · Trendslet Operations" };

type UnassignedRow = {
  id: string;
  sub_order_number: string;
  product_title: string;
  brand_name_raw: string | null;
  quantity: number;
  unit_price: number | null;
  currency: string;
  created_at: string;
  order: {
    id: string;
    shopify_order_number: string;
    customer: { first_name: string | null; last_name: string | null } | null;
  } | null;
};

export default async function UnassignedQueuePage() {
  await requireAdmin();

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("sub_orders")
    .select(`
      id, sub_order_number, product_title, brand_name_raw, quantity, unit_price, currency, created_at,
      order:orders ( id, shopify_order_number, customer:customers ( first_name, last_name ) )
    `)
    .eq("is_unassigned", true)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("[UnassignedQueuePage]", error);
  }

  const rows = (data ?? []) as unknown as UnassignedRow[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-h1 text-ink-primary">Unassigned queue</h1>
        <span className="text-[12px] text-ink-secondary">
          {rows.length} {rows.length === 1 ? "sub-order" : "sub-orders"}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="Queue is empty"
          description="When a Shopify order arrives without a recognized brand, it lands here for manual triage."
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-hairline bg-surface">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-hairline bg-neutral-50/50 text-left text-[11px] font-medium uppercase tracking-[0.4px] text-ink-tertiary">
                <th className="px-4 py-2 font-medium">Sub-order</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Brand (raw)</th>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 text-right font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Age</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const customerName = r.order?.customer
                  ? [r.order.customer.first_name, r.order.customer.last_name].filter(Boolean).join(" ")
                  : "—";
                const lineValue = r.unit_price != null ? r.unit_price * r.quantity : null;
                return (
                  <tr key={r.id} className="border-b border-hairline last:border-0 hover:bg-neutral-50/50">
                    <td className="whitespace-nowrap px-4 py-3 align-top font-medium text-ink-primary">
                      {r.sub_order_number}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="text-ink-primary">{r.product_title}</div>
                      <div className="mt-0.5 text-[11px] text-ink-tertiary">qty {r.quantity}</div>
                    </td>
                    <td className="px-3 py-3 align-top text-ink-secondary">
                      {r.brand_name_raw ? (
                        <span className="pill border border-status-pending-border/40 bg-status-pending-bg text-status-pending-fg">
                          {r.brand_name_raw}
                        </span>
                      ) : (
                        <span className="text-ink-tertiary">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top">
                      {r.order ? (
                        <Link
                          href={`/orders/${r.order.id}`}
                          className="text-navy hover:underline"
                        >
                          {r.order.shopify_order_number}
                        </Link>
                      ) : (
                        <span className="text-ink-tertiary">—</span>
                      )}
                      <div className="mt-0.5 text-[11px] text-ink-tertiary">{customerName}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right align-top tabular-nums text-ink-primary">
                      {lineValue != null ? formatCurrency(lineValue, r.currency) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-[12px] text-ink-tertiary">
                      {relativeTime(r.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right align-top">
                      <AutoAssignButton subOrderId={r.id} subOrderNumber={r.sub_order_number} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
