"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fullDateTime } from "@/lib/utils/date";
import type { ShipmentRow } from "./page";

const STATUS_PILL: Record<string, string> = {
  preparing: "bg-status-pending-bg text-status-pending-fg border-status-pending-border/40",
  in_transit: "bg-status-transit-bg text-status-transit-fg border-status-transit-border/40",
  delivered:  "bg-status-delivered-bg text-status-delivered-fg border-status-delivered-border/40",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn("pill border", STATUS_PILL[status] ?? STATUS_PILL.preparing)}>
      {status.replace("_", " ")}
    </span>
  );
}

export function ShipmentsTable({ rows }: { rows: ShipmentRow[] }) {
  const [selected, setSelected] = React.useState<ShipmentRow | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--hover)] text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {/* Mobile: 3 cols — Desktop: 6 cols */}
              <th className="px-4 py-2.5 text-center font-medium">Tracking</th>
              <th className="px-3 py-2.5 text-center font-medium">Status</th>
              <th className="px-3 py-2.5 text-center font-medium">Shipped</th>
              <th className="hidden px-3 py-2.5 text-center font-medium md:table-cell">Type</th>
              <th className="hidden px-3 py-2.5 text-center font-medium md:table-cell">Carrier</th>
              <th className="hidden px-3 py-2.5 text-center font-medium md:table-cell">Route</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.id}
                onClick={() => setSelected(s)}
                className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-[var(--hover)] md:cursor-default"
              >
                {/* Tracking */}
                <td className="px-4 py-3 text-center font-medium tabular-nums text-[var(--ink)]">
                  {s.tracking_number ?? "—"}
                </td>

                {/* Status */}
                <td className="px-3 py-3 text-center">
                  <StatusPill status={s.status} />
                </td>

                {/* Shipped */}
                <td className="px-3 py-3 text-center text-[12px] text-[var(--muted)]">
                  {s.shipped_at ? fullDateTime(s.shipped_at) : "—"}
                </td>

                {/* Desktop-only cols */}
                <td className="hidden px-3 py-3 text-center capitalize text-[var(--muted)] md:table-cell">
                  {s.shipment_type}
                </td>
                <td className="hidden px-3 py-3 text-center text-[var(--muted)] md:table-cell">
                  {s.carrier?.display_name ?? "—"}
                </td>
                <td className="hidden px-3 py-3 text-center text-[var(--muted)] md:table-cell">
                  {s.origin ?? "?"} → {s.destination ?? "?"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile detail sheet */}
      {selected && typeof document !== "undefined" &&
        createPortal(
          <ShipmentDetailSheet shipment={selected} onClose={() => setSelected(null)} />,
          document.body,
        )}
    </>
  );
}

// ── Mobile detail bottom sheet ────────────────────────────────────────────────

function ShipmentDetailSheet({
  shipment: s,
  onClose,
}: {
  shipment: ShipmentRow;
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[rgba(15,20,25,0.5)]"
        style={{ animation: "backdropIn 0.2s ease forwards" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full overflow-y-auto rounded-t-2xl border-t border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-md)]"
        style={{ animation: "slideUp 0.25s cubic-bezier(0.32,0.72,0.32,1) forwards", maxHeight: "75vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <span className="font-mono text-[14px] font-bold text-[var(--ink)]">
            {s.tracking_number ?? "No tracking"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Detail rows */}
        <div className="flex flex-col divide-y divide-[var(--line)]">
          <DetailRow label="Status">
            <StatusPill status={s.status} />
          </DetailRow>
          <DetailRow label="Shipped">
            <span className="text-[13px] text-[var(--ink)]">
              {s.shipped_at ? fullDateTime(s.shipped_at) : "—"}
            </span>
          </DetailRow>
          <DetailRow label="Type">
            <span className="text-[13px] capitalize text-[var(--ink)]">{s.shipment_type}</span>
          </DetailRow>
          <DetailRow label="Carrier">
            <span className="text-[13px] text-[var(--ink)]">{s.carrier?.display_name ?? "—"}</span>
          </DetailRow>
          <DetailRow label="Route">
            <span className="text-[13px] text-[var(--ink)]">
              {s.origin ?? "?"} → {s.destination ?? "?"}
            </span>
          </DetailRow>
          {s.delivered_at && (
            <DetailRow label="Delivered">
              <span className="text-[13px] text-[var(--ink)]">{fullDateTime(s.delivered_at)}</span>
            </DetailRow>
          )}
        </div>
      </div>

      <style>{`
        @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[12px] font-medium text-[var(--muted)]">{label}</span>
      {children}
    </div>
  );
}
