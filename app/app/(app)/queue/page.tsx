import { ShoppingBag, Inbox } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { fetchFulfillmentQueue } from "@/lib/queries/fulfillment";
import { EmptyState } from "@/components/common/empty-state";
import { SubOrderRow } from "../fulfillment/sub-order-row";
import { getNextStatuses, type Role } from "@/lib/workflow/sub-order-transitions";
import { ROLE_STATUS_WHITELIST } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sourcing · Trendslet Operations" };

export default async function SourcingQueuePage() {
  const user = await requireRole(["sourcing", "admin"]);
  const isAdmin = user.roles.includes("admin");

  // Sourcer sees only US sub-orders for brands assigned to them.
  // The brand-assignment filtering happens via assigned_employee_id —
  // when the Shopify webhook auto-assigns, it picks the primary
  // brand_assignments user (Phase 4d's brand_assignments are already
  // wired in /admin/brands).
  // Admin sees every US sourcing-stage item.
  const rows = await fetchFulfillmentQueue({
    region: "US",
    userId: user.id,
    isAdmin,
    assigneeFilter: isAdmin ? "all" : "self",
  });

  const role: Role = user.roles.includes("sourcing") ? "sourcing" : "admin";

  // Sourcing-relevant groups:
  //   "To buy"   = early stages, sourcer needs to act (in_progress, etc.)
  //   "Bought"   = sourcer purchased, hand-off to warehouse pending
  //   "Handed off" (read-only) = at warehouse or further along, sourcer
  //                              can see status but no longer acts
  const groups = {
    toBuy: rows.filter((r) => TO_BUY_STAGE.has(r.status)),
    bought: rows.filter((r) => BOUGHT_STAGE.has(r.status)),
    handedOff: rows.filter((r) => HANDED_OFF_STAGE.has(r.status)),
  };
  const total =
    groups.toBuy.length + groups.bought.length + groups.handedOff.length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-h1 text-ink-primary">Sourcing</h1>
          <span className="text-[12px] text-ink-tertiary">
            US brands · {total.toLocaleString("en-US")}{" "}
            {total === 1 ? "active sub-order" : "active sub-orders"}
            {isAdmin && total > 0 && " · admin view"}
          </span>
        </div>
      </header>

      {total === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nothing to source"
          description="Items appear here when Shopify orders come in for US brands assigned to you. Check /admin/brands to confirm brand assignments."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <Group
            label="To buy"
            emptyHint="Nothing to buy right now"
            items={groups.toBuy}
            role={role}
          />
          <Group
            label="Bought — hand off to warehouse"
            emptyHint="Nothing waiting for handoff"
            items={groups.bought}
            role={role}
          />
          <Group
            label="Handed off"
            emptyHint="Nothing handed off recently"
            items={groups.handedOff}
            role={role}
            readOnly
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

const TO_BUY_STAGE = new Set([
  "pending",
  "assigned",
  "unassigned",
  "in_progress",
]);

const BOUGHT_STAGE = new Set([
  "purchased_in_store",
  "purchased_online",
]);

// Once the item is at the warehouse, sourcing can SEE the status but
// no longer takes action — it's the warehouse role's responsibility.
const HANDED_OFF_STAGE = new Set([
  "delivered_to_warehouse",
  "under_review",
  "preparing_for_shipment",
  "shipped",
  "arrived_in_ksa",
  "out_for_delivery",
]);
