import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/system";
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Unassigned queue"
        subtitle={<>{rows.length} {rows.length === 1 ? "sub-order" : "sub-orders"}</>}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="Queue is empty"
          description="When a Shopify order arrives without a recognized brand, it lands here for manual triage."
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
          <table className="w-full table-fixed border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--hover)] text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                <th className="w-[30%] whitespace-nowrap px-4 py-2 text-left font-medium md:w-auto">Sub-order</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Product</th>
                <th className="hidden whitespace-nowrap px-3 py-2 font-medium md:table-cell">Brand (raw)</th>
                <th className="hidden whitespace-nowrap px-3 py-2 font-medium md:table-cell">Order</th>
                <th className="hidden whitespace-nowrap px-3 py-2 font-medium md:table-cell">Value</th>
                <th className="hidden whitespace-nowrap px-3 py-2 font-medium md:table-cell">Age</th>
                <th className="w-[110px] whitespace-nowrap px-3 py-2 font-medium md:w-auto">Action</th>
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
                    <td className="whitespace-nowrap px-4 py-3 align-middle font-medium text-ink-primary">
                      {r.sub_order_number}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="truncate text-ink-primary">{r.product_title}</div>
                      <div className="mt-0.5 text-[11px] text-ink-tertiary">qty {r.quantity}</div>
                    </td>
                    <td className="hidden px-3 py-3 align-top text-ink-secondary md:table-cell">
                      {r.brand_name_raw ? (
                        <span className="pill border border-status-pending-border/40 bg-status-pending-bg text-status-pending-fg">
                          {r.brand_name_raw}
                        </span>
                      ) : (
                        <span className="text-ink-tertiary">—</span>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-3 align-top md:table-cell">
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
                    <td className="hidden whitespace-nowrap px-3 py-3 text-center align-top tabular-nums text-ink-primary md:table-cell">
                      {lineValue != null ? formatCurrency(lineValue, r.currency) : "—"}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-3 align-top text-center text-[12px] text-ink-tertiary md:table-cell">
                      {relativeTime(r.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-center align-middle">
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
