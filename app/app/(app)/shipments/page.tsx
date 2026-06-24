import { Truck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { PageHeader, RealtimeRefresh } from "@/components/system";
import { createServiceClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";
import { TrackPanel } from "./track-panel";
import { ShipmentsTable, type ShipmentRow } from "./shipments-table";
import { dhlRequestsToday } from "./actions";

const DHL_DAILY_LIMIT = 250;

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

  const dhlUsed = await dhlRequestsToday();
  const nearLimit = dhlUsed >= DHL_DAILY_LIMIT * 0.8;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Shipments" subtitle="Outbound bulk + last-mile · all stages" />
        <span
          title="DHL tracking API requests used today (resets 00:00 UTC). Each search or refresh = 1 request."
          className={cn(
            "mt-1 shrink-0 rounded-[calc(var(--radius)-4px)] border px-2.5 py-1 text-[12px] font-medium tabular-nums",
            nearLimit
              ? "border-[var(--amber)]/30 bg-[var(--amber-bg)] text-[var(--amber)]"
              : "border-[var(--line)] bg-[var(--hover)] text-[var(--muted)]",
          )}
        >
          DHL: {dhlUsed} / {DHL_DAILY_LIMIT} today
        </span>
      </div>

      <div className="md:max-w-sm">
        <TrackPanel />
      </div>

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
