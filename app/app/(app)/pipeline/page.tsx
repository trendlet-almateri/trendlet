import { Package, CheckCircle2 } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { fetchFulfillmentQueue, type FulfillmentRow } from "@/lib/queries/fulfillment";
import { cn } from "@/lib/utils";
import { SourcingFilterBar } from "@/components/sourcing/sourcing-filter-bar";
import { WarehouseGrid } from "@/components/warehouse/warehouse-grid";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Warehouse · Trendslet Operations" };

type TabKey = "todo" | "in_progress" | "completed";

// Warehouse stages only. Once warehouse hands off to the carrier (shipped),
// the row's next legitimate move is arrived_in_ksa / out_for_delivery /
// delivered — which all belong to KSA last-mile, not warehouse.
const TODO_STAGE      = new Set(["delivered_to_warehouse"]);
const IN_PROG_STAGE   = new Set(["under_review", "preparing_for_shipment"]);
const COMPLETED_STAGE = new Set(["shipped"]);

const TAB_CONFIG = [
  { key: "todo"        as TabKey, label: "To do",       matches: TODO_STAGE,      readOnly: false },
  { key: "in_progress" as TabKey, label: "In progress", matches: IN_PROG_STAGE,   readOnly: false },
  { key: "completed"   as TabKey, label: "Completed",   matches: COMPLETED_STAGE, readOnly: true  },
];

export default async function WarehousePipelinePage({
  searchParams,
}: {
  searchParams?: { tab?: string; brand?: string; sort?: string };
}) {
  const user = await requireRole(["warehouse", "admin"]);
  const isAdmin = user.roles.includes("admin");

  const rows = await fetchFulfillmentQueue({
    region: "US",
    userId: user.id,
    isAdmin,
    assigneeFilter: "all",
  });

  const activeTab  = isTab(searchParams?.tab) ? searchParams!.tab! : "todo";
  const brandFilter = searchParams?.brand ?? "all";
  const sortKey    = (searchParams?.sort ?? "urgent") as "urgent" | "newest" | "oldest";

  const today = new Date().toISOString().slice(0, 10);
  const completedToday = rows.filter(
    (r) => COMPLETED_STAGE.has(r.status) && r.status_changed_at.slice(0, 10) === today,
  ).length;

  const counts = {
    todo:        rows.filter((r) => TODO_STAGE.has(r.status)).length,
    in_progress: rows.filter((r) => IN_PROG_STAGE.has(r.status)).length,
    completed:   completedToday,
  };

  const tasksRemaining = counts.todo + counts.in_progress;

  const brands = Array.from(
    new Map(
      rows.filter((r) => r.brand).map((r) => [r.brand!.id, { id: r.brand!.id, name: r.brand!.name }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const tab = TAB_CONFIG.find((t) => t.key === activeTab)!;
  let visible = rows.filter((r) => tab.matches.has(r.status));
  // Same role-boundary rule as sourcing: warehouse's Completed shows
  // only what was shipped today; older shipments belong to KSA last-mile.
  if (activeTab === "completed") {
    visible = visible.filter((r) => r.status_changed_at.slice(0, 10) === today);
  }
  if (brandFilter !== "all") visible = visible.filter((r) => r.brand?.id === brandFilter);
  visible = sortRows(visible, sortKey);

  const selfName = (user as { fullName?: string; full_name?: string }).fullName
    ?? (user as { fullName?: string; full_name?: string }).full_name
    ?? "You";
  const selfInitials = selfName
    .split(" ")
    .filter(Boolean)
    .map((p: string) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col gap-4 pb-16 md:gap-5">
      {/* ── Page title ── */}
      <div>
        <h1 className="text-[19px] font-bold tracking-[-0.02em] text-[var(--ink)] md:text-[22px]">
          {isAdmin ? "Warehouse tasks" : "My warehouse tasks"}
        </h1>
        {isAdmin && (
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            Admin view · all agents
          </p>
        )}
      </div>

      {/* ── Filter bar ── */}
      <SourcingFilterBar
        brands={brands}
        activeTab={activeTab}
        brandFilter={brandFilter}
        sortKey={sortKey}
        isAdmin={isAdmin}
        action="/pipeline"
      />

      {/* ── Tab pills ── */}
      <TabPills activeTab={activeTab} counts={counts} brandFilter={brandFilter} sortKey={sortKey} />

      {/* ── Card grid ── */}
      {visible.length === 0 && rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--line)] bg-[var(--hover)] py-16 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] bg-white">
            <Package className="h-5 w-5 text-[var(--muted)]" />
          </span>
          <p className="text-[13px] font-medium text-[var(--ink)]">Nothing in the warehouse</p>
          <p className="max-w-[320px] text-[12px] text-[var(--muted)]">
            Items appear here once sourcing marks them delivered to the warehouse.
          </p>
        </div>
      ) : (
        <WarehouseGrid
          rows={visible}
          isReadOnly={tab.readOnly}
          selfName={isAdmin ? undefined : selfName}
          selfInitials={isAdmin ? undefined : selfInitials}
        />
      )}

      {/* ── Bottom status bar ── */}
      <div className="fixed bottom-14 left-0 right-0 z-30 flex items-center justify-between border-t border-[var(--line)] bg-white/90 px-4 py-2.5 backdrop-blur-sm md:bottom-0 md:px-6 lg:left-[var(--sidebar-w,240px)]">
        <span className="text-[12px] text-[var(--muted)]">
          <span className="font-semibold text-[var(--ink)]">{tasksRemaining}</span> tasks remaining
        </span>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span className="font-semibold text-[var(--ink)]">{completedToday}</span> completed today
        </span>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTab(v: string | undefined): v is TabKey {
  return v === "todo" || v === "in_progress" || v === "completed";
}

function sortRows(rows: FulfillmentRow[], sortKey: "urgent" | "newest" | "oldest"): FulfillmentRow[] {
  return [...rows].sort((a, b) => {
    if (sortKey === "urgent") {
      const aU = a.is_delayed ? 2 : a.is_at_risk ? 1 : 0;
      const bU = b.is_delayed ? 2 : b.is_at_risk ? 1 : 0;
      if (bU !== aU) return bU - aU;
      return b.status_changed_at.localeCompare(a.status_changed_at);
    }
    const cmp = a.status_changed_at.localeCompare(b.status_changed_at);
    return sortKey === "oldest" ? cmp : -cmp;
  });
}

function buildQuery(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "all" && !(k === "tab" && v === "todo") && !(k === "sort" && v === "urgent")) {
      sp.set(k, v);
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ─── Tab pills ────────────────────────────────────────────────────────────────

const DOT: Record<TabKey, string> = {
  todo:        "bg-amber-400",
  in_progress: "bg-sky-500",
  completed:   "bg-emerald-500",
};

function TabPills({
  activeTab, counts, brandFilter, sortKey,
}: {
  activeTab: TabKey;
  counts: Record<TabKey, number>;
  brandFilter: string;
  sortKey: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {TAB_CONFIG.map((t) => {
        const active = activeTab === t.key;
        return (
          <Link
            key={t.key}
            href={`/pipeline${buildQuery({ tab: t.key, brand: brandFilter, sort: sortKey })}`}
            className={cn(
              "inline-flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] shadow-[var(--shadow-sm)]"
                : "border-transparent text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", DOT[t.key])} aria-hidden />
            {t.label}
            <span className={cn("tabular-nums text-[12px]", active ? "text-[var(--ink)]" : "text-[var(--muted)]")}>
              {counts[t.key]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
