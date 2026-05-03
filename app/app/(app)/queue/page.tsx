import { ShoppingBag, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { fetchFulfillmentQueue, type FulfillmentRow } from "@/lib/queries/fulfillment";
import { type Role } from "@/lib/workflow/sub-order-transitions";
import { cn } from "@/lib/utils";
import { SourcingGrid } from "@/components/sourcing/sourcing-grid";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sourcing · Trendslet Operations" };

type TabKey = "todo" | "in_progress" | "completed";

const TODO_STAGE     = new Set(["pending", "assigned", "unassigned"]);
const IN_PROG_STAGE  = new Set(["in_progress", "purchased_in_store", "purchased_online"]);
const COMPLETED_STAGE = new Set([
  "delivered_to_warehouse", "under_review", "preparing_for_shipment",
  "shipped", "arrived_in_ksa", "out_for_delivery",
]);

const TAB_CONFIG = [
  { key: "todo" as TabKey,        label: "To do",       matches: TODO_STAGE,      readOnly: false },
  { key: "in_progress" as TabKey, label: "In progress", matches: IN_PROG_STAGE,   readOnly: false },
  { key: "completed" as TabKey,   label: "Completed",   matches: COMPLETED_STAGE, readOnly: true  },
];

export default async function SourcingQueuePage({
  searchParams,
}: {
  searchParams?: { tab?: string; brand?: string; sort?: string };
}) {
  const user = await requireRole(["sourcing", "admin"]);
  const isAdmin = user.roles.includes("admin");
  const role: Role = isAdmin ? "admin" : "sourcing";

  const rows = await fetchFulfillmentQueue({
    region: "US",
    userId: user.id,
    isAdmin,
    assigneeFilter: isAdmin ? "all" : "self",
  });

  const activeTab = isTab(searchParams?.tab) ? searchParams!.tab! : "todo";
  const brandFilter = searchParams?.brand ?? "all";
  const sortKey = (searchParams?.sort ?? "urgent") as "urgent" | "newest" | "oldest";

  // Counts
  const counts = {
    todo:        rows.filter((r) => TODO_STAGE.has(r.status)).length,
    in_progress: rows.filter((r) => IN_PROG_STAGE.has(r.status)).length,
    completed:   rows.filter((r) => COMPLETED_STAGE.has(r.status)).length,
  };

  const today = new Date().toISOString().slice(0, 10);
  const completedToday = rows.filter(
    (r) => COMPLETED_STAGE.has(r.status) && r.status_changed_at.slice(0, 10) === today,
  ).length;
  const tasksRemaining = counts.todo + counts.in_progress;

  // Brands for filter chip
  const brands = Array.from(
    new Map(
      rows.filter((r) => r.brand).map((r) => [r.brand!.id, { id: r.brand!.id, name: r.brand!.name }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Filter + sort
  const tab = TAB_CONFIG.find((t) => t.key === activeTab)!;
  let visible = rows.filter((r) => tab.matches.has(r.status));
  if (brandFilter !== "all") visible = visible.filter((r) => r.brand?.id === brandFilter);
  visible = sortRows(visible, sortKey);

  // User display name for employee view
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
    <div className="flex flex-col gap-5 pb-16">
      {/* ── Page title ── */}
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--ink)]">
          {isAdmin ? "Sourcing tasks" : "My sourcing tasks"}
        </h1>
        {isAdmin && (
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            Admin view · all agents
          </p>
        )}
      </div>

      {/* ── Filter bar ── */}
      <FilterBar
        brands={brands}
        activeTab={activeTab}
        brandFilter={brandFilter}
        sortKey={sortKey}
        isAdmin={isAdmin}
      />

      {/* ── Tab pills ── */}
      <TabPills activeTab={activeTab} counts={counts} brandFilter={brandFilter} sortKey={sortKey} />

      {/* ── Card grid ── */}
      {visible.length === 0 && rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--line)] bg-[var(--hover)] py-16 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] bg-white">
            <ShoppingBag className="h-5 w-5 text-[var(--muted)]" />
          </span>
          <p className="text-[13px] font-medium text-[var(--ink)]">Nothing to source</p>
          <p className="max-w-[320px] text-[12px] text-[var(--muted)]">
            Items appear here when Shopify orders come in for US brands assigned to you.
          </p>
        </div>
      ) : (
        <SourcingGrid
          rows={visible}
          role={role}
          isReadOnly={tab.readOnly}
          selfName={isAdmin ? undefined : selfName}
          selfInitials={isAdmin ? undefined : selfInitials}
        />
      )}

      {/* ── Bottom status bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-[var(--line)] bg-white/90 px-6 py-2.5 backdrop-blur-sm lg:left-[var(--sidebar-w,240px)]">
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
            href={`/queue${buildQuery({ tab: t.key, brand: brandFilter, sort: sortKey })}`}
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

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  brands, activeTab, brandFilter, sortKey, isAdmin,
}: {
  brands: { id: string; name: string }[];
  activeTab: TabKey;
  brandFilter: string;
  sortKey: string;
  isAdmin: boolean;
}) {
  const chipBase = "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] px-3 text-[12px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]";
  const chipActive = "border-[var(--accent)]/30 bg-[var(--accent)]/8 text-[var(--accent)]";

  return (
    <form method="GET" action="/queue" className="flex flex-wrap items-center justify-between gap-3">
      <input type="hidden" name="tab" value={activeTab} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </span>

        {/* Priority — coming soon */}
        <span className={cn(chipBase, "cursor-not-allowed opacity-50")} title="Coming soon">
          + Priority
        </span>

        {/* Region — locked to US for sourcing, shown for admin */}
        {isAdmin ? (
          <span className={cn(chipBase, "cursor-not-allowed opacity-50")} title="Region filter">
            + Region
          </span>
        ) : (
          <span className={cn(chipBase, "cursor-not-allowed opacity-50")} title="Locked to US for sourcing role">
            + Region
          </span>
        )}

        {/* Brand filter */}
        <div className="relative">
          <select
            name="brand"
            defaultValue={brandFilter}
            className={cn(
              chipBase,
              "appearance-none pr-6 cursor-pointer",
              brandFilter !== "all" && chipActive,
            )}
            onChange={(e) => {
              const form = e.currentTarget.form;
              if (form) form.requestSubmit();
            }}
          >
            <option value="all">+ Brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--muted)]" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Agent filter — admin only */}
        {isAdmin && (
          <span className={cn(chipBase, "cursor-not-allowed opacity-50")} title="Agent filter coming soon">
            + Agent
          </span>
        )}
      </div>

      {/* Sort */}
      <div className="relative">
        <select
          name="sort"
          defaultValue={sortKey}
          className={cn(
            "h-8 appearance-none rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] pl-3 pr-7 text-[12px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--hover)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30",
          )}
          onChange={(e) => {
            const form = e.currentTarget.form;
            if (form) form.requestSubmit();
          }}
        >
          <option value="urgent">Sort: Urgent first</option>
          <option value="newest">Sort: Newest first</option>
          <option value="oldest">Sort: Oldest first</option>
        </select>
        <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--muted)]" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </form>
  );
}
