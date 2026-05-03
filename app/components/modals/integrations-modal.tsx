"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, Plug, CheckCircle2, AlertCircle, MinusCircle, XCircle, Circle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type HealthStatus = "ok" | "missing" | "auth_failed" | "error" | "skipped";
type IntegrationHealth = { service: string; status: HealthStatus; detail: string; latency_ms: number | null };

const SERVICE_LABELS: Record<string, string> = {
  supabase: "Supabase",
  shopify: "Shopify",
  twilio: "Twilio WhatsApp",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  dhl: "DHL Express",
  hubstaff: "Hubstaff",
  resend: "Resend",
};

const STATUS_META: Record<HealthStatus, { label: string; icon: typeof CheckCircle2; dotCls: string; pillCls: string }> = {
  ok:          { label: "Connected",          icon: CheckCircle2, dotCls: "bg-[var(--green)]",    pillCls: "border-[var(--green)]/30 bg-[var(--green-bg)] text-[var(--green)]" },
  missing:     { label: "Not configured",     icon: MinusCircle,  dotCls: "bg-[var(--muted-2)]",  pillCls: "border-[var(--line)] bg-[var(--hover)] text-[var(--muted)]" },
  auth_failed: { label: "Auth failed",        icon: XCircle,      dotCls: "bg-[var(--rose)]",     pillCls: "border-[var(--rose)]/30 bg-[var(--rose-bg)] text-[var(--rose)]" },
  error:       { label: "Error",              icon: AlertCircle,  dotCls: "bg-[var(--rose)]",     pillCls: "border-[var(--rose)]/30 bg-[var(--rose-bg)] text-[var(--rose)]" },
  skipped:     { label: "Skipped",            icon: Circle,       dotCls: "bg-[var(--blue)]",     pillCls: "border-[var(--blue)]/30 bg-[var(--blue-bg)] text-[var(--blue)]" },
};

const FILTER_OPTIONS = [
  { key: "all",          label: "All services" },
  { key: "ok",           label: "Connected" },
  { key: "error",        label: "Errors" },
  { key: "missing",      label: "Not configured" },
  { key: "skipped",      label: "Skipped" },
] as const;

type Props = { onClose: () => void };

export function IntegrationsModal({ onClose }: Props) {
  const [results, setResults] = React.useState<IntegrationHealth[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeFilter, setActiveFilter] = React.useState("all");
  const [rechecking, setRechecking] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/admin/integrations").then((r) => r.json()).then(({ results }) => { setResults(results ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const filterCounts = Object.fromEntries(
    ["ok", "error", "auth_failed", "missing", "skipped"].map((s) => [s, results.filter((r) => r.status === s).length]),
  );

  const filtered = results.filter((r) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "error") return r.status === "error" || r.status === "auth_failed";
    return r.status === activeFilter;
  });

  async function recheck() {
    setRechecking(true);
    await fetch("/api/admin/integrations");
    load();
    setRechecking(false);
  }

  const content = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[rgba(15,20,25,0.5)]" style={{ animation: "backdropIn 0.2s ease forwards" }} onClick={onClose} />
      <div className="relative flex h-[580px] w-full max-w-[860px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-md)]" style={{ animation: "riseIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards" }}>

        {/* Sidebar */}
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--hover)]">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]">
              <Plug className="h-4 w-4 text-white" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-[var(--ink)]">Integrations</span>
              <span className="text-[11px] text-[var(--muted)]">Service health</span>
            </div>
          </div>
          <div className="mx-3 h-px bg-[var(--line)]" />
          <div className="flex flex-col gap-0.5 p-2 pt-3">
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">Filter by status</p>
            {FILTER_OPTIONS.map(({ key, label }) => {
              const count = key === "all" ? results.length : key === "error" ? (filterCounts["error"] + filterCounts["auth_failed"]) : filterCounts[key] ?? 0;
              return (
                <button key={key} type="button" onClick={() => setActiveFilter(key)}
                  className={cn("flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] transition-colors text-left",
                    activeFilter === key ? "bg-[var(--accent)]/10 font-medium text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--line)] hover:text-[var(--ink)]")}>
                  <div className="flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full",
                      key === "ok" ? "bg-[var(--green)]" : key === "error" ? "bg-[var(--rose)]" : key === "skipped" ? "bg-[var(--blue)]" : activeFilter === key ? "bg-[var(--accent)]" : "bg-[var(--line)]")} />
                    {label}
                  </div>
                  <span className="text-[11px] tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          <div className="border-t border-[var(--line)] p-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">Connected</p>
            <p className="text-[22px] font-semibold tabular-nums text-[var(--ink)]">{filterCounts["ok"] ?? 0} <span className="text-[14px] text-[var(--muted)]">/ {results.length}</span></p>
          </div>
        </aside>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-start justify-between border-b border-[var(--line)] px-6 py-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--ink)]">Integrations</h2>
              <p className="text-[12px] text-[var(--muted)]">Real-time health status of all connected services.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={recheck} disabled={rechecking}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--hover)] disabled:opacity-50">
                <RefreshCw className={cn("h-3 w-3", rechecking && "animate-spin")} />
                Recheck
              </button>
              <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading && <div className="flex items-center justify-center py-16 text-[12px] text-[var(--muted)]">Checking services…</div>}
            {!loading && filtered.length === 0 && <div className="flex items-center justify-center py-16 text-[12px] text-[var(--muted)]">No results.</div>}
            {!loading && (
              <div className="flex flex-col gap-2">
                {filtered.map((r) => {
                  const meta = STATUS_META[r.status];
                  const Icon = meta.icon;
                  return (
                    <div key={r.service} className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] px-4 py-3 shadow-[var(--shadow-sm)]">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dotCls)} />
                      <Icon className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[13px] font-medium text-[var(--ink)]">{SERVICE_LABELS[r.service] ?? r.service}</span>
                        <span className="truncate text-[11px] text-[var(--muted)]">{r.detail}</span>
                      </div>
                      <span className={cn("shrink-0 rounded-full border px-2 py-px text-[10px] font-semibold", meta.pillCls)}>{meta.label}</span>
                      {r.latency_ms !== null && (
                        <span className="shrink-0 font-[family-name:var(--font-jetbrains,monospace)] text-[10px] tabular-nums text-[var(--muted)]">{r.latency_ms}ms</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
