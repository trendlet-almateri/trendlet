"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, Search, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

type CarrierRow = {
  id: string;
  name: string;
  display_name: string;
  region: string | null;
  is_active: boolean;
  api_endpoint: string | null;
};

const REGION_CLS: Record<string, string> = {
  US: "bg-blue-100 text-blue-700",
  EU: "bg-violet-100 text-violet-700",
  KSA: "bg-emerald-100 text-emerald-700",
  GLOBAL: "bg-[var(--hover)] text-[var(--muted)]",
};

type Props = { onClose: () => void };

export function CarriersModal({ onClose }: Props) {
  const [carriers, setCarriers] = React.useState<CarrierRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeFilter, setActiveFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    fetch("/api/admin/carriers").then((r) => r.json()).then(({ carriers }) => { setCarriers(carriers ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const regions = ["US", "EU", "KSA", "GLOBAL"];
  const regionCounts = Object.fromEntries(regions.map((r) => [r, carriers.filter((c) => c.region === r).length]));
  const activeCount = carriers.filter((c) => c.is_active).length;

  const filtered = carriers.filter((c) => {
    const matchFilter = activeFilter === "all" ? true : activeFilter === "active" ? c.is_active : c.region === activeFilter;
    const q = search.toLowerCase();
    return matchFilter && (!q || c.display_name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  });

  const content = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[rgba(15,20,25,0.5)]" style={{ animation: "backdropIn 0.2s ease forwards" }} onClick={onClose} />
      <div className="relative flex h-[580px] w-full max-w-[860px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-md)]" style={{ animation: "riseIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards" }}>

        {/* Sidebar */}
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--hover)]">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]">
              <Truck className="h-4 w-4 text-white" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-[var(--ink)]">Carriers</span>
              <span className="text-[11px] text-[var(--muted)]">Shipping partners</span>
            </div>
          </div>
          <div className="mx-3 h-px bg-[var(--line)]" />
          <div className="flex flex-col gap-0.5 p-2 pt-3">
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">Filter</p>
            <SidebarFilter label="All carriers" count={carriers.length} active={activeFilter === "all"} onClick={() => setActiveFilter("all")} />
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
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">Total carriers</p>
            <p className="text-[22px] font-semibold tabular-nums text-[var(--ink)]">{carriers.length}</p>
            <p className="text-[11px] text-[var(--muted)]">{activeCount} active</p>
          </div>
        </aside>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-start justify-between border-b border-[var(--line)] px-6 py-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--ink)]">Carriers</h2>
              <p className="text-[12px] text-[var(--muted)]">Shipping partners and delivery integrations.</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="border-b border-[var(--line)] px-4 py-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
              <input type="text" placeholder="Search carriers…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] pl-8 pr-3 text-[12px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40" />
            </div>
          </div>
          <div className="grid grid-cols-[2fr_0.7fr_0.6fr_1.2fr] items-center gap-3 border-b border-[var(--line)] bg-[var(--hover)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.4px] text-[var(--muted)]">
            <span>Carrier</span><span>Region</span><span>Status</span><span>Endpoint</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="flex items-center justify-center py-16 text-[12px] text-[var(--muted)]">Loading…</div>}
            {!loading && filtered.length === 0 && <div className="flex items-center justify-center py-16 text-[12px] text-[var(--muted)]">No carriers found.</div>}
            {!loading && filtered.map((c) => (
              <div key={c.id} className="grid grid-cols-[2fr_0.7fr_0.6fr_1.2fr] items-center gap-3 border-b border-[var(--line)] px-4 py-3 transition-colors hover:bg-[var(--hover)] last:border-0">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] font-medium text-[var(--ink)]">{c.display_name}</span>
                  <span className="truncate text-[11px] text-[var(--muted)]">{c.name}</span>
                </div>
                <div>
                  {c.region
                    ? <span className={cn("rounded px-1.5 py-px text-[10px] font-semibold", REGION_CLS[c.region] ?? "bg-[var(--hover)] text-[var(--muted)]")}>{c.region}</span>
                    : <span className="text-[11px] text-[var(--muted)]">Global</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", c.is_active ? "bg-[var(--green)]" : "bg-[var(--muted-2)]")} />
                  <span className="text-[12px] text-[var(--muted)]">{c.is_active ? "Active" : "Off"}</span>
                </div>
                <span className="truncate font-[family-name:var(--font-jetbrains,monospace)] text-[11px] tabular-nums text-[var(--muted)]">
                  {c.api_endpoint ?? "—"}
                </span>
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
