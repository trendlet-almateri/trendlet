import Link from "next/link";
import { ShoppingBag, Inbox } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { fetchFulfillmentQueue, type FulfillmentRow } from "@/lib/queries/fulfillment";
import { EmptyState } from "@/components/common/empty-state";
import { SubOrderRow } from "../fulfillment/sub-order-row";
import { getNextStatuses, type Role } from "@/lib/workflow/sub-order-transitions";
import { ROLE_STATUS_WHITELIST } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sourcing · Trendslet Operations" };

type TabKey = "todo" | "in_progress" | "completed";

const TODO_STAGE = new Set(["pending", "assigned", "unassigned", "in_progress"]);
const IN_PROGRESS_STAGE = new Set(["purchased_in_store", "purchased_online"]);
const COMPLETED_STAGE = new Set([
  "delivered_to_warehouse",
  "under_review",
  "preparing_for_shipment",
  "shipped",
  "arrived_in_ksa",
  "out_for_delivery",
]);

const TAB_CONFIG: { key: TabKey; label: string; matches: Set<string>; readOnly: boolean }[] = [
  { key: "todo", label: "To do", matches: TODO_STAGE, readOnly: false },
  { key: "in_progress", label: "In progress", matches: IN_PROGRESS_STAGE, readOnly: false },
  { key: "completed", label: "Completed", matches: COMPLETED_STAGE, readOnly: true },
];

export default async function SourcingQueuePage({
  searchParams,
}: {
  searchParams?: { tab?: string; brand?: string; sort?: string };
}) {
  const user = await requireRole(["sourcing", "admin"]);
  const isAdmin = user.roles.includes("admin");

  const rows = await fetchFulfillmentQueue({
    region: "US",
    userId: user.id,
    isAdmin,
    assigneeFilter: isAdmin ? "all" : "self",
  });

  const role: Role = user.roles.includes("sourcing") ? "sourcing" : "admin";
  const activeTab = isTab(searchParams?.tab) ? searchParams!.tab! : "todo";
  const brandFilter = searchParams?.brand ?? "all";
  const sortKey = searchParams?.sort === "oldest" ? "oldest" : "newest";

  const counts = {
    todo: rows.filter((r) => TODO_STAGE.has(r.status)).length,
    in_progress: rows.filter((r) => IN_PROGRESS_STAGE.has(r.status)).length,
    completed: rows.filter((r) => COMPLETED_STAGE.has(r.status)).length,
  };

  const brands = Array.from(
    new Map(
      rows.filter((r) => r.brand).map((r) => [r.brand!.id, { id: r.brand!.id, name: r.brand!.name }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const tab = TAB_CONFIG.find((t) => t.key === activeTab)!;
  let visible = rows.filter((r) => tab.matches.has(r.status));
  if (brandFilter !== "all") {
    visible = visible.filter((r) => r.brand?.id === brandFilter);
  }
  visible = sortRows(visible, sortKey);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1 text-ink-primary">My sourcing tasks</h1>
        <span className="text-[12px] text-ink-tertiary">
          US brands · {rows.length.toLocaleString("en-US")}{" "}
          {rows.length === 1 ? "active sub-order" : "active sub-orders"}
          {isAdmin && rows.length > 0 && " · admin view"}
        </span>
      </header>

      <FilterBar brands={brands} activeTab={activeTab} brandFilter={brandFilter} sortKey={sortKey} />

      <Tabs activeTab={activeTab} counts={counts} brandFilter={brandFilter} sortKey={sortKey} />

      {visible.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Nothing to source"
            description="Items appear here when Shopify orders come in for US brands assigned to you. Check /admin/brands to confirm brand assignments."
          />
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-hairline-strong bg-neutral-50 px-3 py-6 text-[12px] text-ink-tertiary">
            <Inbox className="h-3 w-3" aria-hidden />
            Nothing in this view{brandFilter !== "all" ? " for the selected brand" : ""}.
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((row) => (
            <SubOrderRow
              key={row.id}
              row={row}
              layout="card"
              nextStatuses={
                tab.readOnly ? [] : getNextStatuses(row.status, role, ROLE_STATUS_WHITELIST)
              }
              canUploadReceipt={!tab.readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function isTab(v: string | undefined): v is TabKey {
  return v === "todo" || v === "in_progress" || v === "completed";
}

function sortRows(rows: FulfillmentRow[], sortKey: "newest" | "oldest"): FulfillmentRow[] {
  const sorted = [...rows].sort((a, b) =>
    a.status_changed_at < b.status_changed_at ? -1 : 1,
  );
  return sortKey === "newest" ? sorted.reverse() : sorted;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "all" && !(k === "tab" && v === "todo") && !(k === "sort" && v === "newest")) {
      sp.set(k, v);
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function Tabs({
  activeTab,
  counts,
  brandFilter,
  sortKey,
}: {
  activeTab: TabKey;
  counts: Record<TabKey, number>;
  brandFilter: string;
  sortKey: "newest" | "oldest";
}) {
  const dotColor: Record<TabKey, string> = {
    todo: "bg-status-pending-border",
    in_progress: "bg-status-sourcing-border",
    completed: "bg-status-delivered-border",
  };
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-hairline bg-surface p-1 text-[12px]">
      {TAB_CONFIG.map((t) => (
        <Link
          key={t.key}
          href={`/queue${buildQuery({ tab: t.key, brand: brandFilter, sort: sortKey })}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 font-medium transition-colors",
            activeTab === t.key
              ? "bg-neutral-100 text-ink-primary"
              : "text-ink-tertiary hover:bg-neutral-50 hover:text-ink-primary",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[t.key])} aria-hidden />
          {t.label}
          <span className="tabular-nums text-ink-tertiary">{counts[t.key]}</span>
        </Link>
      ))}
    </div>
  );
}

function FilterBar({
  brands,
  activeTab,
  brandFilter,
  sortKey,
}: {
  brands: { id: string; name: string }[];
  activeTab: TabKey;
  brandFilter: string;
  sortKey: "newest" | "oldest";
}) {
  return (
    <form
      method="GET"
      action="/queue"
      className="flex flex-wrap items-center gap-2 text-[12px]"
    >
      <input type="hidden" name="tab" value={activeTab} />
      <select
        name="brand"
        defaultValue={brandFilter}
        className="h-7 rounded-md border border-hairline bg-surface px-2 text-[11px] text-ink-primary focus:outline-none focus:ring-1 focus:ring-ink-primary"
        aria-label="Filter by brand"
      >
        <option value="all">All brands</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <select
        name="sort"
        defaultValue={sortKey}
        className="h-7 rounded-md border border-hairline bg-surface px-2 text-[11px] text-ink-primary focus:outline-none focus:ring-1 focus:ring-ink-primary"
        aria-label="Sort by"
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>
      <button
        type="submit"
        className="inline-flex h-7 items-center rounded-md border border-hairline bg-surface px-2 text-[11px] font-medium text-ink-primary hover:bg-neutral-50"
      >
        Apply
      </button>
    </form>
  );
}
