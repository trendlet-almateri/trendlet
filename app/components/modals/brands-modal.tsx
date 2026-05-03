"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, Search, Tag, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type BrandRow = {
  id: string;
  name: string;
  region: "US" | "EU" | "KSA" | "GLOBAL" | null;
  is_active: boolean;
  markup_percent: number;
  primary_assignee: { user_id: string; full_name: string | null } | null;
};

const REGION_CLS: Record<string, string> = {
  US: "bg-blue-100 text-blue-700",
  EU: "bg-violet-100 text-violet-700",
  KSA: "bg-emerald-100 text-emerald-700",
  GLOBAL: "bg-[var(--hover)] text-[var(--muted)]",
};

const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500",
  "bg-amber-500", "bg-rose-500", "bg-cyan-500",
  "bg-orange-500", "bg-indigo-500",
];

function brandAvatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function BrandsModal({ onClose }: { onClose: () => void }) {
  const [brands, setBrands] = React.useState<BrandRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeFilter, setActiveFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    fetch("/api/admin/brands")
      .then((r) => r.json())
      .then(({ brands }) => {
        setBrands(brands ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const regionCounts = {
    US: brands.filter((b) => b.region === "US").length,
    EU: brands.filter((b) => b.region === "EU").length,
    KSA: brands.filter((b) => b.region === "KSA").length,
    GLOBAL: brands.filter((b) => b.region === "GLOBAL").length,
  };
  const unassignedCount = brands.filter((b) => !b.primary_assignee).length;

  const filtered = brands.filter((b) => {
    const matchRegion =
      activeFilter === "all" ||
      (activeFilter === "unassigned" ? !b.primary_assignee : b.region === activeFilter);
    const q = search.toLowerCase();
    const matchSearch = !q || b.name.toLowerCase().includes(q) ||
      (b.primary_assignee?.full_name?.toLowerCase().includes(q) ?? false);
    return matchRegion && matchSearch;
  });

  const content = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[rgba(15,20,25,0.5)]"
        style={{ animation: "backdropIn 0.2s ease forwards" }}
        onClick={onClose}
      />
      <div
        className="relative flex h-[640px] w-full max-w-[880px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-md)]"
        style={{ animation: "riseIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards" }}
      >
        {/* ── Left sidebar ── */}
        <aside className="flex w-[240px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--hover)]">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]">
              <Tag className="h-4 w-4 text-white" aria-hidden />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-[var(--ink)]">Brands</span>
              <span className="text-[11px] text-[var(--muted)]">Assignments &amp; routing</span>
            </div>
          </div>

          <div className="mx-3 h-px bg-[var(--line)]" />

          <div className="flex flex-col gap-0.5 p-2 pt-3">
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">
              Filter by region
            </p>
            <SidebarFilter label="All brands" count={brands.length} active={activeFilter === "all"} onClick={() => setActiveFilter("all")} />
            {(["US", "EU", "KSA", "GLOBAL"] as const).map((r) => (
              regionCounts[r] > 0 && (
                <SidebarFilter key={r} label={r} count={regionCounts[r]} active={activeFilter === r} onClick={() => setActiveFilter(r)} />
              )
            ))}
          </div>

          {unassignedCount > 0 && (
            <>
              <div className="mx-3 mt-2 h-px bg-[var(--line)]" />
              <div className="flex flex-col gap-0.5 p-2 pt-3">
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">Alerts</p>
                <SidebarFilter
                  label="Unassigned"
                  count={unassignedCount}
                  active={activeFilter === "unassigned"}
                  onClick={() => setActiveFilter("unassigned")}
                  warn
                />
              </div>
            </>
          )}

          <div className="flex-1" />

          <div className="border-t border-[var(--line)] p-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">Total brands</p>
            <p className="text-[22px] font-semibold tabular-nums text-[var(--ink)]">{brands.length}</p>
            <p className="text-[11px] text-[var(--muted)]">{unassignedCount} unassigned</p>
          </div>
        </aside>

        {/* ── Right content ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[var(--line)] px-6 py-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--ink)]">Brands &amp; assignments</h2>
              <p className="text-[12px] text-[var(--muted)]">
                Manage brand routing rules and primary assignees per region.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/admin/brands"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--hover)]"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
                Full view
              </a>
              <button
                type="button"
                onClick={onClose}
                className="grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="border-b border-[var(--line)] px-4 py-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
              <input
                type="text"
                placeholder="Search brands or assignees…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] pl-8 pr-3 text-[12px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
              />
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[2fr_0.6fr_0.7fr_1.5fr_24px] items-center gap-3 border-b border-[var(--line)] bg-[var(--hover)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.4px] text-[var(--muted)]">
            <span>Brand</span>
            <span>Region</span>
            <span className="text-right">Markup</span>
            <span>Primary assignee</span>
            <span />
          </div>

          {/* Brand rows */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-16 text-[12px] text-[var(--muted)]">Loading…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="flex items-center justify-center py-16 text-[12px] text-[var(--muted)]">No brands found.</div>
            )}
            {!loading && filtered.map((b) => <BrandRowItem key={b.id} brand={b} />)}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function SidebarFilter({
  label, count, active, onClick, warn = false,
}: { label: string; count: number; active: boolean; onClick: () => void; warn?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] transition-colors text-left",
        active
          ? warn
            ? "bg-[var(--rose-bg)] font-medium text-[var(--rose)]"
            : "bg-[var(--accent)]/10 font-medium text-[var(--accent)]"
          : "text-[var(--muted)] hover:bg-[var(--line)] hover:text-[var(--ink)]",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          active ? (warn ? "bg-[var(--rose)]" : "bg-[var(--accent)]") : "bg-[var(--line)]",
        )} />
        {label}
      </div>
      <span className={cn(
        "text-[11px] tabular-nums",
        warn && !active && "text-[var(--rose)]",
      )}>{count}</span>
    </button>
  );
}

function BrandRowItem({ brand: b }: { brand: BrandRow }) {
  const letter = b.name.slice(0, 1).toUpperCase();
  const avatarCls = brandAvatarColor(b.name);
  const isUnassigned = !b.primary_assignee;

  return (
    <div
      className={cn(
        "grid grid-cols-[2fr_0.6fr_0.7fr_1.5fr_24px] items-center gap-3 border-b border-[var(--line)] px-4 py-2.5 transition-colors hover:bg-[var(--hover)] last:border-0",
        isUnassigned && "bg-[var(--rose-bg)]/30",
      )}
    >
      {/* Brand */}
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md text-[11px] font-bold text-white", avatarCls)}>
          {letter}
        </span>
        <span className="truncate text-[13px] font-medium text-[var(--ink)]">{b.name}</span>
      </div>

      {/* Region */}
      <div>
        {b.region ? (
          <span className={cn("rounded px-1.5 py-px text-[10px] font-semibold", REGION_CLS[b.region] ?? "bg-[var(--hover)] text-[var(--muted)]")}>
            {b.region}
          </span>
        ) : (
          <span className="text-[11px] text-[var(--muted)]">—</span>
        )}
      </div>

      {/* Markup */}
      <div className="text-right">
        <span className="font-[family-name:var(--font-jetbrains,monospace)] text-[12px] tabular-nums text-[var(--muted)]">
          {b.markup_percent}%
        </span>
      </div>

      {/* Assignee */}
      <div>
        {b.primary_assignee?.full_name ? (
          <span className="truncate text-[12px] text-[var(--ink)]">{b.primary_assignee.full_name}</span>
        ) : (
          <span className="pill border border-[var(--rose)]/40 bg-[var(--rose-bg)] text-[10px] text-[var(--rose)]">
            Unassigned
          </span>
        )}
      </div>

      {/* Menu */}
      <button
        type="button"
        className="grid h-6 w-6 place-items-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]"
        aria-label="More options"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
    </div>
  );
}
