import { Warehouse, Inbox } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { fetchFulfillmentQueue } from "@/lib/queries/fulfillment";
import { EmptyState } from "@/components/common/empty-state";
import { SubOrderRow } from "../fulfillment/sub-order-row";
import { getNextStatuses, type Role } from "@/lib/workflow/sub-order-transitions";
import { ROLE_STATUS_WHITELIST } from "@/lib/constants";
import { PageHeader } from "@/components/system";

export const dynamic = "force-dynamic";

export const metadata = { title: "Warehouse · Trendslet Operations" };

export default async function WarehousePipelinePage() {
  const user = await requireRole(["warehouse", "admin"]);
  const isAdmin = user.roles.includes("admin");

  // Warehouse sees ALL US orders regardless of which sourcer brought them.
  // Admin sees the same set in this view (their global view is /orders).
  const rows = await fetchFulfillmentQueue({
    region: "US",
    userId: user.id,
    isAdmin,
    assigneeFilter: "all",
  });

  // Use the warehouse role's whitelist for button visibility — admin
  // would otherwise see early-stage buttons that warehouse never owns.
  const role: Role = user.roles.includes("warehouse") ? "warehouse" : "admin";

  // Warehouse-relevant groups only. Items in a sourcing-stage status
  // (in_progress, purchased_*) shouldn't be visible here at all because
  // they happen BEFORE the item lands at the warehouse — the
  // delivered_to_warehouse hand-off is the entry point.
  //
  // We DO surface "incoming" items so warehouse sees what's about to
  // arrive, but with no actions until they hit delivered_to_warehouse.
  const groups = {
    incoming: rows.filter((r) => INCOMING_STAGE.has(r.status)),
    warehouse: rows.filter((r) => WAREHOUSE_STAGE.has(r.status)),
    transit: rows.filter((r) => TRANSIT_STAGE.has(r.status)),
  };
  const total = groups.incoming.length + groups.warehouse.length + groups.transit.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Warehouse"
        subtitle={<>US brands · {total.toLocaleString("en-US")} {total === 1 ? "active sub-order" : "active sub-orders"}{isAdmin && total > 0 && " · admin view"}</>}
      />

      {total === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="Nothing in the warehouse pipeline"
          description="US-brand sub-orders appear here once a sourcing employee marks them purchased. Configure brands in /admin/brands with region=US to start the flow."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <Group
            label="Incoming"
            emptyHint="Nothing on its way to the warehouse"
            items={groups.incoming}
            role={role}
            readOnly
          />
          <Group
            label="At warehouse"
            emptyHint="Nothing currently in the warehouse"
            items={groups.warehouse}
            role={role}
          />
          <Group
            label="In transit / KSA"
            emptyHint="Nothing in transit"
            items={groups.transit}
            role={role}
          />
        </div>
      )}
    </div>
  );
}

function Group({
  label,
  emptyHint,
  items,
  role,
  readOnly = false,
}: {
  label: string;
  emptyHint: string;
  items: Awaited<ReturnType<typeof fetchFulfillmentQueue>>;
  role: Role;
  readOnly?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
        <span className="rounded-sm bg-[var(--hover)] px-1.5 py-0.5 tabular-nums text-[var(--muted)]">
          {items.length}
        </span>
      </h2>
      {items.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-[var(--line)] bg-[var(--hover)] px-3 py-3 text-[12px] text-[var(--muted)]">
          <Inbox className="h-3 w-3" aria-hidden />
          {emptyHint}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((row) => (
            <SubOrderRow
              key={row.id}
              row={row}
              // Read-only group: render no buttons regardless of role
              // whitelist (warehouse cannot act on items still being sourced).
              nextStatuses={
                readOnly ? [] : getNextStatuses(row.status, role, ROLE_STATUS_WHITELIST)
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

// Sourcing-side statuses warehouse can SEE but not act on.
const INCOMING_STAGE = new Set([
  "in_progress",
  "purchased_in_store",
  "purchased_online",
]);

const WAREHOUSE_STAGE = new Set([
  "delivered_to_warehouse",
  "under_review",
  "preparing_for_shipment",
]);

const TRANSIT_STAGE = new Set([
  "shipped",
  "arrived_in_ksa",
  "out_for_delivery",
]);
