import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/system";
import { CreateShipmentForm, type ShippableSubOrder } from "./create-shipment-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create shipment · Trendslet Operations" };

// Sub-orders that have been bought but not yet handed to the customer — the
// ones that could plausibly be in a consignment leaving the US.
const SHIPPABLE_STATUSES = [
  "purchased_online",
  "purchased_in_store",
  "under_review",
  "preparing_for_shipment",
  "shipped",
];

async function loadShippable(): Promise<ShippableSubOrder[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("sub_orders")
    .select("id, sub_order_number, product_title, status, order:orders(customer:customers(first_name, last_name, phone))")
    .in("status", SHIPPABLE_STATUSES)
    .order("sub_order_number", { ascending: false })
    .limit(300);

  type Row = {
    id: string;
    sub_order_number: string;
    product_title: string | null;
    status: string;
    order: { customer: { first_name: string | null; last_name: string | null; phone: string | null } | null } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    subOrderNumber: r.sub_order_number,
    productTitle: r.product_title ?? "—",
    status: r.status,
    customerName: [r.order?.customer?.first_name, r.order?.customer?.last_name]
      .filter(Boolean).join(" ").trim() || "—",
    hasPhone: Boolean(r.order?.customer?.phone),
  }));
}

export default async function CreateShipmentPage() {
  await requireAdmin();
  const shippable = await loadShippable();
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-[var(--muted)]">
        <Link href="/shipments" className="hover:text-[var(--ink)]">Shipments</Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <span className="text-[var(--ink-2)]">Create</span>
      </nav>
      <PageHeader title="Create DHL shipment" subtitle="Creates a REAL shipment. Fill every field, then confirm." />
      <CreateShipmentForm shippable={shippable} />
    </div>
  );
}
