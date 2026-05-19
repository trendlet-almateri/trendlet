import { Truck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { PageHeader, RealtimeRefresh } from "@/components/system";
import { createServiceClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/common/empty-state";
import { TrackPanel } from "./track-panel";
import { ShipmentsTable, type ShipmentRow } from "./shipments-table";

export const dynamic = "force-dynamic";

export const metadata = { title: "Shipments · Trendslet Operations" };

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

      <TrackPanel />

      {rows.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No shipments yet"
          description="Shipments are created when warehouse marks sub-orders as shipped. Bulk outbound to KSA and last-mile within KSA both land here."
        />
      ) : (
        <ShipmentsTable rows={rows} />
      )}
      <RealtimeRefresh />
    </div>
  );
}
