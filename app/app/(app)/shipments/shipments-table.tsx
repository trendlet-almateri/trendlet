"use client";

import * as React from "react";
import { ChevronDown, RefreshCw, X } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { TrackResult } from "@/lib/integrations/dhl";
import { refreshTrackingAction } from "./actions";

export type ShipmentRow = {
  id: string;
  shipment_type: string;
  origin: string | null;
  destination: string | null;
  tracking_number: string | null;
  status: string;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  carrier: { display_name: string } | null;
};

const STATUS_PILL: Record<string, string> = {
  "pre-transit": "border-[var(--blue)]/30 bg-[var(--blue-bg)] text-[var(--blue)]",
  preparing: "bg-status-pending-bg text-status-pending-fg border-status-pending-border/40",
  transit: "border-[var(--amber)]/30 bg-[var(--amber-bg)] text-[var(--amber)]",
  in_transit: "bg-status-transit-bg text-status-transit-fg border-status-transit-border/40",
  delivered: "bg-status-delivered-bg text-status-delivered-fg border-status-delivered-border/40",
  failure: "border-[var(--rose)]/30 bg-[var(--rose-bg)] text-[var(--rose)]",
  unknown: "border-[var(--line)] bg-[var(--hover)] text-[var(--muted)]",
};

function fmt(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d.getTime()) ? ts : d.toLocaleString();
}

export function ShipmentsTable({ rows }: { rows: ShipmentRow[] }) {
  const [openId,     setOpenId]     = React.useState<string | null>(null);
  const [mobileRow,  setMobileRow]  = React.useState<ShipmentRow | null>(null);
  const [detail,     setDetail]     = React.useState<Record<string, TrackResult | "loading" | "error">>({});
  const [refreshing, setRefreshing] = React.useState<string | null>(null);

  // Load full DHL detail for the stored tracking number — no re-entry.
  const loadDetail = React.useCallback(async (id: string, tn: string) => {
    setDetail((d) => ({ ...d, [id]: "loading" }));
    try {
      const res = await fetch(`/api/shipments/track?trackingNumber=${encodeURIComponent(tn)}`);
      const data = (await res.json()) as TrackResult;
      setDetail((d) => ({ ...d, [id]: data.found ? data : "error" }));
    } catch {
      setDetail((d) => ({ ...d, [id]: "error" }));
    }
  }, []);

  function openMobile(row: ShipmentRow) {
    setMobileRow(row);
    if (row.tracking_number && !detail[row.id]) loadDetail(row.id, row.tracking_number);
  }

  // Desktop: toggle expand row
  function toggle(row: ShipmentRow) {
    if (!row.tracking_number) return;
    if (openId === row.id) { setOpenId(null); return; }
    setOpenId(row.id);
    if (!detail[row.id]) loadDetail(row.id, row.tracking_number);
  }

  async function refresh(row: ShipmentRow, e: React.MouseEvent) {
    e.stopPropagation();
    if (!row.tracking_number) return;
    setRefreshing(row.id);
    await refreshTrackingAction(row.tracking_number);
    await loadDetail(row.id, row.tracking_number);
    setRefreshing(null);
    window.location.reload();
  }

  return (
    <>
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--line)] bg-[var(--hover)] text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            {/* Mobile: 3 cols — Desktop: 7 cols, all centered */}
            <th className="whitespace-nowrap px-4 py-2.5 text-center font-medium">Tracking</th>
            <th className="whitespace-nowrap px-3 py-2.5 text-center font-medium">Status</th>
            <th className="whitespace-nowrap px-3 py-2.5 text-center font-medium">Shipped</th>
            <th className="hidden whitespace-nowrap px-3 py-2.5 text-center font-medium md:table-cell">Type</th>
            <th className="hidden whitespace-nowrap px-3 py-2.5 text-center font-medium md:table-cell">Carrier</th>
            <th className="hidden whitespace-nowrap px-3 py-2.5 text-center font-medium md:table-cell">Route</th>
            <th className="hidden whitespace-nowrap px-3 py-2.5 text-center font-medium md:table-cell">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const d    = detail[s.id];
            const open = openId === s.id;
            return (
              <React.Fragment key={s.id}>
                <tr
                  onClick={() => { if (window.innerWidth < 768) openMobile(s); else toggle(s); }}
                  className={cn(
                    "border-b border-[var(--line)] last:border-0 hover:bg-[var(--hover)]",
                    s.tracking_number && "cursor-pointer",
                  )}
                >
                  {/* Tracking — mobile + desktop */}
                  <td className="px-4 py-3 text-center font-medium tabular-nums text-[var(--ink)]">
                    <span className="inline-flex items-center justify-center gap-1.5">
                      {s.tracking_number && (
                        <ChevronDown
                          className={cn("hidden size-3.5 text-[var(--muted)] transition-transform md:block", open && "rotate-180")}
                        />
                      )}
                      {s.tracking_number ?? "—"}
                    </span>
                  </td>
                  {/* Status — mobile + desktop */}
                  <td className="px-3 py-3 text-center">
                    <span className={cn("pill border", STATUS_PILL[s.status] ?? STATUS_PILL.unknown)}>
                      {s.status.replace("_", " ")}
                    </span>
                  </td>
                  {/* Shipped — mobile + desktop */}
                  <td className="px-3 py-3 text-center text-[12px] text-[var(--muted)]">
                    {s.shipped_at ? fmt(s.shipped_at) : "—"}
                  </td>
                  {/* Desktop-only cols */}
                  <td className="hidden px-3 py-3 text-center capitalize text-[var(--muted)] md:table-cell">{s.shipment_type}</td>
                  <td className="hidden px-3 py-3 text-center text-[var(--muted)] md:table-cell">{s.carrier?.display_name ?? "—"}</td>
                  <td className="hidden px-3 py-3 text-center text-[var(--muted)] md:table-cell">
                    {s.origin ?? "?"} → {s.destination ?? "?"}
                  </td>
                  <td className="hidden px-3 py-3 text-center md:table-cell">
                    {s.tracking_number && (
                      <button
                        onClick={(e) => refresh(s, e)}
                        disabled={refreshing === s.id}
                        className="inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-4px)] border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--hover)] disabled:opacity-50"
                      >
                        <RefreshCw className={cn("size-3.5", refreshing === s.id && "animate-spin")} />
                        Refresh
                      </button>
                    )}
                  </td>
                </tr>

                {/* Desktop-only expand row — DHL tracking events */}
                {open && (
                  <tr className="hidden border-b border-[var(--line)] bg-[var(--bg)] md:table-row">
                    <td colSpan={7} className="px-6 py-4">
                      {d === "loading" && (
                        <p className="text-[12px] text-[var(--muted)]">Loading from DHL…</p>
                      )}
                      {d === "error" && (
                        <p className="text-[12px] text-[var(--rose)]">Could not load tracking detail from DHL.</p>
                      )}
                      {d && d !== "loading" && d !== "error" && (
                        <div>
                          <p className="mb-3 text-[12px] text-ink-tertiary">
                            {d.description ?? d.status ?? d.status_code ?? "—"}
                            {d.estimated_delivery ? ` · ETA ${fmt(d.estimated_delivery)}` : ""}
                            {d.pieces ? ` · ${d.pieces} piece(s)` : ""}
                          </p>
                          <ol className="max-h-72 overflow-y-auto">
                            {d.events.map((e, i) => (
                              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                                <div className="flex flex-col items-center">
                                  <span
                                    className={cn(
                                      "mt-1 size-2 rounded-full",
                                      i === 0 ? "bg-[var(--accent)]" : "bg-[var(--muted-2)]",
                                    )}
                                  />
                                  {i < d.events.length - 1 && <span className="w-px flex-1 bg-[var(--line)]" />}
                                </div>
                                <div className="flex-1 pb-1">
                                  <p className="text-[13px] text-ink-primary">{e.description}</p>
                                  <p className="text-[11px] text-ink-tertiary">
                                    {fmt(e.timestamp)}
                                    {e.location ? ` · ${e.location}` : ""}
                                  </p>
                                </div>
                              </li>
                            ))}
                            {d.events.length === 0 && (
                              <li className="text-[12px] text-ink-tertiary">No tracking events yet.</li>
                            )}
                          </ol>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>

    {mobileRow && typeof document !== "undefined" &&
      createPortal(
        <MobileSheet
          shipment={mobileRow}
          detail={detail[mobileRow.id]}
          refreshing={refreshing === mobileRow.id}
          onRefresh={(e) => refresh(mobileRow, e)}
          onClose={() => setMobileRow(null)}
        />,
        document.body,
      )}
    </>
  );
}

// ── Mobile bottom sheet ───────────────────────────────────────────────────────

function MobileSheet({
  shipment: s,
  detail: d,
  refreshing,
  onRefresh,
  onClose,
}: {
  shipment: ShipmentRow;
  detail: TrackResult | "loading" | "error" | undefined;
  refreshing: boolean;
  onRefresh: (e: React.MouseEvent) => void;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center md:hidden">
      <div
        className="absolute inset-0 bg-[rgba(15,20,25,0.5)]"
        style={{ animation: "backdropIn 0.2s ease forwards" }}
        onClick={onClose}
      />
      <div
        className="relative w-full overflow-y-auto rounded-t-2xl border-t border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-md)]"
        style={{ animation: "slideUp 0.25s cubic-bezier(0.32,0.72,0.32,1) forwards", maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[14px] font-bold text-[var(--ink)]">
              {s.tracking_number ?? "No tracking number"}
            </span>
            <span className="text-[11px] text-[var(--muted)] capitalize">{s.shipment_type} · {s.carrier?.display_name ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            {s.tracking_number && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1 rounded-[calc(var(--radius)-4px)] border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--hover)] disabled:opacity-50"
              >
                <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
                Refresh
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Key details */}
        <div className="flex flex-col divide-y divide-[var(--line)]">
          <Row label="Status">
            <span className={cn("pill border", STATUS_PILL[s.status] ?? STATUS_PILL.unknown)}>
              {s.status.replace("_", " ")}
            </span>
          </Row>
          <Row label="Route">
            <span className="text-[13px] text-[var(--ink)]">{s.origin ?? "?"} → {s.destination ?? "?"}</span>
          </Row>
          <Row label="Shipped">
            <span className="text-[13px] text-[var(--ink)]">{s.shipped_at ? fmt(s.shipped_at) : "—"}</span>
          </Row>
          {s.delivered_at && (
            <Row label="Delivered">
              <span className="text-[13px] text-[var(--ink)]">{fmt(s.delivered_at)}</span>
            </Row>
          )}
        </div>

        {/* DHL tracking events */}
        {s.tracking_number && (
          <div className="px-4 py-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-[var(--muted)]">
              Tracking Events
            </p>
            {d === "loading" && <p className="text-[12px] text-[var(--muted)]">Loading from DHL…</p>}
            {d === "error"   && <p className="text-[12px] text-[var(--rose)]">Could not load from DHL.</p>}
            {d && d !== "loading" && d !== "error" && (
              <>
                {d.description && (
                  <p className="mb-3 text-[12px] text-[var(--muted)]">
                    {d.description}{d.estimated_delivery ? ` · ETA ${fmt(d.estimated_delivery)}` : ""}
                  </p>
                )}
                <ol>
                  {d.events.map((e, i) => (
                    <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span className={cn("mt-1 size-2 rounded-full", i === 0 ? "bg-[var(--accent)]" : "bg-[var(--muted-2)]")} />
                        {i < d.events.length - 1 && <span className="w-px flex-1 bg-[var(--line)]" />}
                      </div>
                      <div className="flex-1 pb-1">
                        <p className="text-[13px] text-[var(--ink)]">{e.description}</p>
                        <p className="text-[11px] text-[var(--muted)]">
                          {fmt(e.timestamp)}{e.location ? ` · ${e.location}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                  {d.events.length === 0 && (
                    <li className="text-[12px] text-[var(--muted)]">No tracking events yet.</li>
                  )}
                </ol>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[12px] font-medium text-[var(--muted)]">{label}</span>
      {children}
    </div>
  );
}
