import { requireAdmin } from "@/lib/auth/require-role";
import { fetchAdminOrders } from "@/lib/queries/orders";
import { fetchBrandsForAdmin, fetchAssigneeOptions } from "@/lib/queries/brands";
import { OrdersView } from "@/components/orders/orders-view";
import { OrdersRealtime } from "@/components/orders/orders-realtime";
import { PageHeader, TabPills } from "@/components/system";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

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

  // Pull orders + brand list + assignee list concurrently. Counts come from the
  // same fetch (mock dataset is small). When volume grows, swap counts for a
  // separate aggregated query.
  const [all, brandsData, assigneesData] = await Promise.all([
    fetchAdminOrders({ limit: 500, filter: "all" }),
    fetchBrandsForAdmin(),
    fetchAssigneeOptions(),
  ]);
  // Reshape for the filter popover — it only needs name / id+full_name.
  const brands = brandsData.map((b) => ({ name: b.name }));
  const assignees = assigneesData.map((a) => ({ id: a.id, full_name: a.full_name }));

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

  // Revenue today: sum SAR orders created today. Mixing currencies is wrong,
  // so we headline SAR and let the rest fall outside the card.
  const todayKey = new Date().toISOString().slice(0, 10);
  const revenueTodaySAR = all.reduce((sum, o) => {
    if ((o.shopify_created_at ?? "").slice(0, 10) !== todayKey) return sum;
    if ((o.currency ?? "SAR") !== "SAR") return sum;
    return sum + (o.total ?? 0);
  }, 0);

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
    <div className="flex flex-col gap-7">
      <PageHeader title="Orders" />

      {/* Summary stats — same card language as Tax Invoices / Invoices */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatsCard label="Active Orders"     value={counts.active.toLocaleString("en-US")}     tone={counts.active > 0     ? "blue"  : "ink"} />
        <StatsCard label="Unassigned Orders" value={counts.unassigned.toLocaleString("en-US")} tone={counts.unassigned > 0 ? "rose"  : "ink"} />
        <StatsCard label="Completed Orders"  value={counts.done.toLocaleString("en-US")}       tone={counts.done > 0       ? "green" : "ink"} />
        <StatsCard label="Delayed Orders"    value={counts.delayed.toLocaleString("en-US")}    tone={counts.delayed > 0    ? "amber" : "ink"} />
        <StatsCard label="Revenue Today"     value={formatCurrency(revenueTodaySAR, "SAR", { compact: true })} tone="ink" />
      </div>

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

      <OrdersView
        orders={filtered}
        totalCount={counts.all}
        brands={brands}
        assignees={assignees}
      />
      <OrdersRealtime />
    </div>
  );
}

// ── Stats card (matches Tax Invoices / Invoices visual language) ─────────────
function StatsCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ink" | "blue" | "rose" | "green" | "amber";
}) {
  return (
    <div className="rounded-[14px] border border-[var(--line)] bg-[var(--panel)] px-4 py-3.5 shadow-[0_1px_2px_rgba(15,20,25,0.03)]">
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted)]">
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 text-[22px] font-semibold leading-none tracking-tight font-[family-name:var(--font-jetbrains,_monospace)] tabular-nums",
          tone === "ink"   && "text-[var(--ink)]",
          tone === "blue"  && "text-[var(--blue)]",
          tone === "rose"  && "text-[var(--rose)]",
          tone === "green" && "text-[var(--green)]",
          tone === "amber" && "text-[var(--amber)]",
        )}
      >
        {value}
      </div>
    </div>
  );
}
