"use client";

import * as React from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
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
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<Record<string, TrackResult | "loading" | "error">>({});
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

  function toggle(row: ShipmentRow) {
    if (!row.tracking_number) return;
    if (openId === row.id) {
      setOpenId(null);
      return;
    }
    setOpenId(row.id);
    if (!detail[row.id]) loadDetail(row.id, row.tracking_number);
  }

  async function refresh(row: ShipmentRow, e: React.MouseEvent) {
    e.stopPropagation();
    if (!row.tracking_number) return;
    setRefreshing(row.id);
    // Re-poll DHL with the STORED number and update the saved row.
    await refreshTrackingAction(row.tracking_number);
    await loadDetail(row.id, row.tracking_number);
    setRefreshing(null);
    window.location.reload(); // pull the freshly-updated row from the server
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--line)] bg-[var(--hover)] text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            <th className="whitespace-nowrap px-4 py-2 text-left font-medium">Tracking</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Type</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Carrier</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Route</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Status</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Shipped</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const d = detail[s.id];
            const open = openId === s.id;
            return (
              <React.Fragment key={s.id}>
                <tr
                  onClick={() => toggle(s)}
                  className={cn(
                    "border-b border-[var(--line)] last:border-0 hover:bg-[var(--hover)]",
                    s.tracking_number && "cursor-pointer",
                  )}
                >
                  <td className="px-4 py-3 font-medium tabular-nums text-ink-primary">
                    <span className="inline-flex items-center gap-1.5">
                      {s.tracking_number && (
                        <ChevronDown
                          className={cn("size-3.5 text-[var(--muted)] transition-transform", open && "rotate-180")}
                        />
                      )}
                      {s.tracking_number ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-3 capitalize text-ink-secondary">{s.shipment_type}</td>
                  <td className="px-3 py-3 text-ink-secondary">{s.carrier?.display_name ?? "—"}</td>
                  <td className="px-3 py-3 text-ink-secondary">
                    {s.origin ?? "?"} → {s.destination ?? "?"}
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("pill border", STATUS_PILL[s.status] ?? STATUS_PILL.unknown)}>
                      {s.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-ink-tertiary">
                    {s.shipped_at ? fmt(s.shipped_at) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    {s.tracking_number && (
                      <button
                        onClick={(e) => refresh(s, e)}
                        disabled={refreshing === s.id}
                        className="inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-4px)] border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1 text-[12px] font-medium text-ink-secondary transition-colors hover:bg-[var(--hover)] disabled:opacity-50"
                      >
                        <RefreshCw className={cn("size-3.5", refreshing === s.id && "animate-spin")} />
                        Refresh
                      </button>
                    )}
                  </td>
                </tr>

                {open && (
                  <tr className="border-b border-[var(--line)] bg-[var(--bg)]">
                    <td colSpan={7} className="px-6 py-4">
                      {d === "loading" && (
                        <p className="text-[12px] text-ink-tertiary">Loading from DHL…</p>
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
  );
}
