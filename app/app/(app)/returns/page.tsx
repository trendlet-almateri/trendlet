import { CornerDownLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { PageHeader } from "@/components/system";
import { createServiceClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/common/empty-state";
import { relativeTime } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

export const metadata = { title: "Returns · Trendslet Operations" };

type ReturnRow = {
  id: string;
  sub_order_number: string;
  product_title: string;
  brand_name_raw: string | null;
  status_changed_at: string;
  order: { id: string; shopify_order_number: string } | null;
};

export default async function ReturnsPage() {
  await requireAdmin();
  const sb = createServiceClient();

  const { data, error } = await sb
    .from("sub_orders")
    .select(`
      id, sub_order_number, product_title, brand_name_raw, status_changed_at,
      order:orders ( id, shopify_order_number )
    `)
    .eq("status", "returned")
    .order("status_changed_at", { ascending: false })
    .limit(100);

  if (error) console.error("[ReturnsPage]", error);
  const rows = (data ?? []) as unknown as ReturnRow[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Returns" subtitle={<>{rows.length} {rows.length === 1 ? "return" : "returns"}</>} />

      {rows.length === 0 ? (
        <EmptyState
          icon={CornerDownLeft}
          title="No returns"
          description="Items marked with status returned will appear here for processing."
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--hover)] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                <th className="px-4 py-2 font-medium">Sub-order</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Returned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--hover)]">
                  <td className="px-4 py-3 font-medium text-ink-primary">{r.sub_order_number}</td>
                  <td className="px-3 py-3 text-ink-primary">{r.product_title}</td>
                  <td className="px-3 py-3 text-ink-secondary">{r.brand_name_raw ?? "—"}</td>
                  <td className="px-3 py-3 text-ink-secondary">
                    {r.order?.shopify_order_number ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-ink-tertiary">
                    {relativeTime(r.status_changed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
