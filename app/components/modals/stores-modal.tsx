"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, Search, Store } from "lucide-react";
import { cn } from "@/lib/utils";

type StoreRow = {
  id: string;
  name: string;
  shopify_domain: string;
  region: string | null;
  is_active: boolean;
  default_currency: string;
  created_at: string;
};

const REGION_CLS: Record<string, string> = {
  US: "bg-blue-100 text-blue-700",
  EU: "bg-violet-100 text-violet-700",
  KSA: "bg-emerald-100 text-emerald-700",
  GLOBAL: "bg-[var(--hover)] text-[var(--muted)]",
};

type Props = { onClose: () => void };

export function StoresModal({ onClose }: Props) {
  const [stores, setStores] = React.useState<StoreRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeFilter, setActiveFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    fetch("/api/admin/stores").then((r) => r.json()).then(({ stores }) => { setStores(stores ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const regions = ["US", "EU", "KSA", "GLOBAL"];
  const regionCounts = Object.fromEntries(regions.map((r) => [r, stores.filter((s) => s.region === r).length]));
  const activeCount = stores.filter((s) => s.is_active).length;

  const filtered = stores.filter((s) => {
    const matchRegion = activeFilter === "all" || activeFilter === "active"
      ? (activeFilter === "active" ? s.is_active : true)
      : s.region === activeFilter;
    const q = search.toLowerCase();
    return matchRegion && (!q || s.name.toLowerCase().includes(q) || s.shopify_domain.toLowerCase().includes(q));
  });

  const content = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[rgba(15,20,25,0.5)]" style={{ animation: "backdropIn 0.2s ease forwards" }} onClick={onClose} />
      <div className="relative flex h-[580px] w-full max-w-[860px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-md)]" style={{ animation: "riseIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards" }}>

        {/* Sidebar */}
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--hover)]">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]">
              <Store className="h-4 w-4 text-white" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-[var(--ink)]">Stores</span>
              <span className="text-[11px] text-[var(--muted)]">Shopify connections</span>
            </div>
          </div>
          <div className="mx-3 h-px bg-[var(--line)]" />
          <div className="flex flex-col gap-0.5 p-2 pt-3">
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">Filter</p>
            <SidebarFilter label="All stores" count={stores.length} active={activeFilter === "all"} onClick={() => setActiveFilter("all")} />
            <SidebarFilter label="Active" count={activeCount} active={activeFilter === "active"} onClick={() => setActiveFilter("active")} />
          </div>
          {regions.some((r) => regionCounts[r] > 0) && (
            <>
              <div className="mx-3 mt-2 h-px bg-[var(--line)]" />
              <div className="flex flex-col gap-0.5 p-2 pt-3">
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">By region</p>
                {regions.filter((r) => regionCounts[r] > 0).map((r) => (
                  <SidebarFilter key={r} label={r} count={regionCounts[r]} active={activeFilter === r} onClick={() => setActiveFilter(r)} />
                ))}
              </div>
            </>
          )}
          <div className="flex-1" />
          <div className="border-t border-[var(--line)] p-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">Total stores</p>
            <p className="text-[22px] font-semibold tabular-nums text-[var(--ink)]">{stores.length}</p>
            <p className="text-[11px] text-[var(--muted)]">{activeCount} active</p>
          </div>
        </aside>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-start justify-between border-b border-[var(--line)] px-6 py-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--ink)]">Stores</h2>
              <p className="text-[12px] text-[var(--muted)]">Manage your connected Shopify stores and webhooks.</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="border-b border-[var(--line)] px-4 py-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
              <input type="text" placeholder="Search stores…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] pl-8 pr-3 text-[12px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40" />
            </div>
          </div>
          <div className="grid grid-cols-[2fr_0.7fr_0.6fr_0.7fr] items-center gap-3 border-b border-[var(--line)] bg-[var(--hover)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.4px] text-[var(--muted)]">
            <span>Store</span><span>Region</span><span>Currency</span><span>Status</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="flex items-center justify-center py-16 text-[12px] text-[var(--muted)]">Loading…</div>}
            {!loading && filtered.length === 0 && <div className="flex items-center justify-center py-16 text-[12px] text-[var(--muted)]">No stores found.</div>}
            {!loading && filtered.map((s) => (
              <div key={s.id} className="grid grid-cols-[2fr_0.7fr_0.6fr_0.7fr] items-center gap-3 border-b border-[var(--line)] px-4 py-3 transition-colors hover:bg-[var(--hover)] last:border-0">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-medium text-[var(--ink)]">{s.name}</span>
                  <span className="truncate font-[family-name:var(--font-jetbrains,monospace)] text-[11px] tabular-nums text-[var(--muted)]">{s.shopify_domain}</span>
                </div>
                <div>
                  {s.region
                    ? <span className={cn("rounded px-1.5 py-px text-[10px] font-semibold", REGION_CLS[s.region] ?? "bg-[var(--hover)] text-[var(--muted)]")}>{s.region}</span>
                    : <span className="text-[11px] text-[var(--muted)]">—</span>}
                </div>
                <span className="font-[family-name:var(--font-jetbrains,monospace)] text-[12px] tabular-nums text-[var(--muted)]">{s.default_currency}</span>
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", s.is_active ? "bg-[var(--green)]" : "bg-[var(--muted-2)]")} />
                  <span className="text-[12px] text-[var(--muted)]">{s.is_active ? "Active" : "Inactive"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function SidebarFilter({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] transition-colors text-left",
        active ? "bg-[var(--accent)]/10 font-medium text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--line)] hover:text-[var(--ink)]")}>
      <div className="flex items-center gap-2">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-[var(--accent)]" : "bg-[var(--line)]")} />
        {label}
      </div>
      <span className="text-[11px] tabular-nums">{count}</span>
    </button>
  );
}
