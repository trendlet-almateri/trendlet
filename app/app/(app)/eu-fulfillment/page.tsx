import { Globe, CheckCircle2 } from "lucide-react";
import { RealtimeRefresh } from "@/components/system";
import { requireRole } from "@/lib/auth/require-role";
import { fetchFulfillmentQueue, type FulfillmentRow } from "@/lib/queries/fulfillment";
import { cn } from "@/lib/utils";
import { SourcingFilterBar } from "@/components/sourcing/sourcing-filter-bar";
import { EuGrid } from "@/components/eu/eu-grid";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "EU Fulfillment · Trendslet Operations" };

type TabKey = "todo" | "in_progress" | "completed";

// Fulfiller = sourcing + warehouse, end-to-end.
// Tab routing now uses marked_done_at (set explicitly on the final
// button click) instead of status alone. A row stays in In progress
// even at status='delivered' until the user clicks Mark delivered.
//   To do:        pending/assigned/unassigned AND not yet marked done
//   Completed:    marked_done_at IS NOT NULL (regardless of status)
//   In progress:  everything else in the role's lifecycle
const TODO_STATUSES = new Set(["pending", "assigned", "unassigned"]);
const FULFILLER_STATUSES = new Set([
  "pending", "assigned", "unassigned",
  "in_progress", "purchased_online", "purchased_in_store",
  "out_of_stock",
  "delivered_to_warehouse", "shipped", "delivered",
]);

type Row = { status: string; marked_done_at: string | null };

const matchTodo       = (r: Row) => !r.marked_done_at && TODO_STATUSES.has(r.status);
const matchCompleted  = (r: Row) => r.marked_done_at !== null;
const matchInProgress = (r: Row) =>
  !r.marked_done_at && FULFILLER_STATUSES.has(r.status) && !TODO_STATUSES.has(r.status);

const TAB_CONFIG = [
  { key: "todo"        as TabKey, label: "To do",       match: matchTodo,       readOnly: false },
  { key: "in_progress" as TabKey, label: "In progress", match: matchInProgress, readOnly: false },
  { key: "completed"   as TabKey, label: "Completed",   match: matchCompleted,  readOnly: true  },
];

export default async function EuFulfillmentPage({
  searchParams,
}: {
  searchParams?: { tab?: string; brand?: string; sort?: string };
}) {
  const user = await requireRole(["fulfiller", "admin"]);
  const isAdmin = user.roles.includes("admin");

  const rows = await fetchFulfillmentQueue({
    region: "EU",
    userId: user.id,
    isAdmin,
    assigneeFilter: isAdmin ? "all" : "self",
  });

  const activeTab   = isTab(searchParams?.tab) ? searchParams!.tab! : "todo";
  const brandFilter = searchParams?.brand ?? "all";
  const sortKey     = (searchParams?.sort ?? "urgent") as "urgent" | "newest" | "oldest";

  const counts = {
    todo:        rows.filter(matchTodo).length,
    in_progress: rows.filter(matchInProgress).length,
    completed:   rows.filter(matchCompleted).length,
  };

  const today = new Date().toISOString().slice(0, 10);
  const completedToday = rows.filter(
    (r) => matchCompleted(r) && (r.marked_done_at ?? "").slice(0, 10) === today,
  ).length;
  const tasksRemaining = counts.todo + counts.in_progress;

  const brands = Array.from(
    new Map(
      rows.filter((r) => r.brand).map((r) => [r.brand!.id, { id: r.brand!.id, name: r.brand!.name }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const tab = TAB_CONFIG.find((t) => t.key === activeTab)!;
  let visible = rows.filter(tab.match);
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
          {isAdmin ? "EU fulfillment tasks" : "My EU fulfillment tasks"}
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
        action="/eu-fulfillment"
      />

      {/* ── Tab pills ── */}
      <TabPills activeTab={activeTab} counts={counts} brandFilter={brandFilter} sortKey={sortKey} />

      {/* ── Card grid ── */}
      {visible.length === 0 && rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--line)] bg-[var(--hover)] py-16 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] bg-white">
            <Globe className="h-5 w-5 text-[var(--muted)]" />
          </span>
          <p className="text-[13px] font-medium text-[var(--ink)]">No EU tasks</p>
          <p className="max-w-[320px] text-[12px] text-[var(--muted)]">
            Items appear here when EU brand orders come in and are assigned to you.
          </p>
        </div>
      ) : (
        <EuGrid
          rows={visible}
          isReadOnly={tab.readOnly}
          selfName={isAdmin ? undefined : selfName}
          selfInitials={isAdmin ? undefined : selfInitials}
        />
      )}

      {/* ── Bottom status bar ── */}
      <div className="fixed bottom-14 left-0 right-0 z-30 flex items-center justify-between border-t border-[var(--line)] bg-white/90 px-4 py-2.5 backdrop-blur-sm md:bottom-0 md:left-[220px] md:px-6">
        <span className="text-[12px] text-[var(--muted)]">
          <span className="font-semibold text-[var(--ink)]">{tasksRemaining}</span> tasks remaining
        </span>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span className="font-semibold text-[var(--ink)]">{completedToday}</span> completed today
        </span>
      </div>
      <RealtimeRefresh />
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
            href={`/eu-fulfillment${buildQuery({ tab: t.key, brand: brandFilter, sort: sortKey })}`}
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
