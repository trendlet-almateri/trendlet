import { Globe, Inbox } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { fetchFulfillmentQueue } from "@/lib/queries/fulfillment";
import { EmptyState } from "@/components/common/empty-state";
import { SubOrderRow } from "./sub-order-row";
import { getNextStatuses, type Role } from "@/lib/workflow/sub-order-transitions";
import { ROLE_STATUS_WHITELIST } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata = { title: "EU fulfillment · Trendslet Operations" };

export default async function FulfillmentPage() {
  const user = await requireRole(["fulfiller", "admin"]);
  const isAdmin = user.roles.includes("admin");

  const rows = await fetchFulfillmentQueue({
    region: "EU",
    userId: user.id,
    isAdmin,
    // Admin sees everyone's EU work; fulfiller sees only their own.
    assigneeFilter: isAdmin ? "all" : "self",
  });

  // Pick the role we'll use to filter visible buttons. Fulfiller takes
  // precedence over admin so admins see the same affordances the EU
  // employee would see (less surprise when they assist).
  const role: Role = user.roles.includes("fulfiller") ? "fulfiller" : "admin";

  // Group by stage for readable scanning. Within a stage, sub-orders
  // are already sorted by status_changed_at ASC (oldest first).
  const groups = {
    sourcing: rows.filter((r) => SOURCING_STAGE.has(r.status)),
    warehouse: rows.filter((r) => WAREHOUSE_STAGE.has(r.status)),
    transit: rows.filter((r) => TRANSIT_STAGE.has(r.status)),
  };

  const total = rows.length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-h1 text-ink-primary">EU fulfillment</h1>
          <span className="text-[12px] text-ink-tertiary">
            {total.toLocaleString("en-US")}{" "}
            {total === 1 ? "active sub-order" : "active sub-orders"}
            {isAdmin && rows.length > 0 && " · admin view"}
          </span>
        </div>
      </header>

      {total === 0 ? (
        <EmptyState
          icon={Globe}
          title="Nothing in your EU queue"
          description="Sub-orders for EU brands assigned to you will appear here. Make sure brands are configured in /admin/brands with region=EU and a primary assignee."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <Group
            label="Sourcing"
            emptyHint="Nothing to buy right now"
            items={groups.sourcing}
            role={role}
          />
          <Group
            label="Warehouse"
            emptyHint="Nothing at the warehouse"
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
}: {
  label: string;
  emptyHint: string;
  items: Awaited<ReturnType<typeof fetchFulfillmentQueue>>;
  role: Role;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.4px] text-ink-tertiary">
        {label}
        <span className="rounded-sm bg-neutral-100 px-1.5 py-0.5 tabular-nums">
          {items.length}
        </span>
      </h2>
      {items.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-hairline-strong bg-neutral-50 px-3 py-3 text-[12px] text-ink-tertiary">
          <Inbox className="h-3 w-3" aria-hidden />
          {emptyHint}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((row) => (
            <SubOrderRow
              key={row.id}
              row={row}
              nextStatuses={getNextStatuses(row.status, role, ROLE_STATUS_WHITELIST)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

const SOURCING_STAGE = new Set([
  "pending",
  "assigned",
  "unassigned",
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
