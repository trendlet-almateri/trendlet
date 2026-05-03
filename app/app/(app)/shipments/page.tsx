import { Truck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { PageHeader } from "@/components/system";
import { createServiceClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/common/empty-state";
import { fullDateTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Shipments · Trendslet Operations" };

type ShipmentRow = {
  id: string;
  shipment_type: string;
  origin: string | null;
  destination: string | null;
  tracking_number: string | null;
  status: string;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  carrier: { display_name: string } | null;
};

const STATUS_PILL: Record<string, string> = {
  preparing: "bg-status-pending-bg text-status-pending-fg border-status-pending-border/40",
  in_transit: "bg-status-transit-bg text-status-transit-fg border-status-transit-border/40",
  delivered: "bg-status-delivered-bg text-status-delivered-fg border-status-delivered-border/40",
};

export default async function ShipmentsPage() {
  await requireAdmin();
  const sb = createServiceClient();

  const { data, error } = await sb
    .from("shipments")
    .select(`
      id, shipment_type, origin, destination, tracking_number, status,
      shipped_at, delivered_at, created_at,
      carrier:carriers ( display_name )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) console.error("[ShipmentsPage]", error);
  const rows = (data ?? []) as unknown as ShipmentRow[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Shipments" subtitle="Outbound bulk + last-mile · all stages" />

      {rows.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No shipments yet"
          description="Shipments are created when warehouse marks sub-orders as shipped. Bulk outbound to KSA and last-mile within KSA both land here."
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--hover)] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                <th className="px-4 py-2 font-medium">Tracking</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Carrier</th>
                <th className="px-3 py-2 font-medium">Route</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Shipped</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--hover)]">
                  <td className="px-4 py-3 font-medium tabular-nums text-ink-primary">
                    {s.tracking_number ?? "—"}
                  </td>
                  <td className="px-3 py-3 capitalize text-ink-secondary">{s.shipment_type}</td>
                  <td className="px-3 py-3 text-ink-secondary">{s.carrier?.display_name ?? "—"}</td>
                  <td className="px-3 py-3 text-ink-secondary">
                    {s.origin ?? "?"} → {s.destination ?? "?"}
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("pill border", STATUS_PILL[s.status] ?? STATUS_PILL.preparing)}>
                      {s.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-ink-tertiary">
                    {s.shipped_at ? fullDateTime(s.shipped_at) : "—"}
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
