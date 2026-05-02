import { requireAdmin } from "@/lib/auth/require-role";
import { fetchAdminOrders } from "@/lib/queries/orders";
import { OrdersView } from "@/components/orders/orders-view";
import { PageHeader, TabPills } from "@/components/system";

export const dynamic = "force-dynamic";

export const metadata = { title: "Orders · Trendslet Operations" };

const VALID_FILTERS = ["all", "active", "delayed", "done", "unassigned"] as const;
type FilterKey = (typeof VALID_FILTERS)[number];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  await requireAdmin();

  const requested = searchParams.filter as FilterKey | undefined;
  const filter: FilterKey = requested && VALID_FILTERS.includes(requested) ? requested : "all";

  // Pull all orders once; counts come from the same fetch (mock dataset is small).
  // When volume grows, swap counts for a separate aggregated query.
  const all = await fetchAdminOrders({ limit: 500, filter: "all" });

  const counts = {
    all: all.length,
    active: all.filter((o) =>
      o.sub_orders.some((s) => s.status !== "delivered" && s.status !== "cancelled" && s.status !== "returned"),
    ).length,
    delayed: all.filter((o) => o.sub_orders.some((s) => s.is_delayed)).length,
    done: all.filter((o) =>
      o.sub_orders.every((s) => s.status === "delivered" || s.status === "cancelled" || s.status === "returned"),
    ).length,
    unassigned: all.filter((o) => o.sub_orders.some((s) => s.is_unassigned)).length,
  };

  const filtered =
    filter === "all"
      ? all
      : filter === "active"
        ? all.filter((o) =>
            o.sub_orders.some((s) => s.status !== "delivered" && s.status !== "cancelled" && s.status !== "returned"),
          )
        : filter === "delayed"
          ? all.filter((o) => o.sub_orders.some((s) => s.is_delayed))
          : filter === "done"
            ? all.filter((o) =>
                o.sub_orders.every((s) => s.status === "delivered" || s.status === "cancelled" || s.status === "returned"),
              )
            : all.filter((o) => o.sub_orders.some((s) => s.is_unassigned));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Orders" />

      <TabPills
        activeKey={filter}
        tabs={[
          { key: "all", label: "All orders", count: counts.all },
          { key: "active", label: "Active", count: counts.active },
          { key: "delayed", label: "Delayed", count: counts.delayed },
          { key: "done", label: "Completed", count: counts.done },
          { key: "unassigned", label: "Unassigned", count: counts.unassigned },
        ]}
        hrefFor={(key) => (key === "all" ? "/orders" : `/orders?filter=${key}`)}
      />

      <OrdersView orders={filtered} totalCount={counts.all} />
    </div>
  );
}
