"use client";

import * as React from "react";
import { Plus, RefreshCw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { addTrackingNumberAction } from "./actions";
import type { TrackResult } from "@/lib/integrations/dhl";

const STATUS_PILL: Record<string, string> = {
  "pre-transit": "border-[var(--blue)]/30 bg-[var(--blue-bg)] text-[var(--blue)]",
  transit: "border-[var(--amber)]/30 bg-[var(--amber-bg)] text-[var(--amber)]",
  delivered: "border-[var(--green)]/30 bg-[var(--green-bg)] text-[var(--green)]",
  failure: "border-[var(--rose)]/30 bg-[var(--rose-bg)] text-[var(--rose)]",
  unknown: "border-[var(--line)] bg-[var(--hover)] text-[var(--muted)]",
};

function fmt(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d.getTime()) ? ts : d.toLocaleString();
}

/** Add-a-tracking-number form + live DHL detail preview. */
export function TrackPanel() {
  const [tn, setTn] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<TrackResult | null>(null);

  async function lookup() {
    const value = tn.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch(`/api/shipments/track?trackingNumber=${encodeURIComponent(value)}`);
      const data = (await res.json()) as TrackResult;
      if (!data.found) {
        setError(data.error ?? "No shipment found");
      } else {
        setPreview(data);
      }
    } catch {
      setError("Lookup failed — check connection");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    const res = await addTrackingNumberAction(preview.tracking_number);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not save");
      return;
    }
    setPreview(null);
    setTn("");
    // server action revalidates /shipments — refresh to show the new row
    window.location.reload();
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={tn}
            onChange={(e) => setTn(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="Enter a DHL tracking number…"
            className="w-full rounded-[calc(var(--radius)-4px)] border border-[var(--line)] bg-[var(--bg)] py-2 pl-9 pr-3 text-[13px] text-ink-primary outline-none transition-colors focus:border-[var(--accent)]"
          />
        </div>
        <button
          onClick={lookup}
          disabled={busy || !tn.trim()}
          className="inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-4px)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-[var(--hover)] disabled:opacity-50"
        >
          {busy ? <RefreshCw className="size-4 animate-spin" /> : <Search className="size-4" />}
          Look up
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-[calc(var(--radius)-4px)] border border-[var(--rose)]/30 bg-[var(--rose-bg)] px-3 py-2 text-[12px] text-[var(--rose)]">
          {error}
        </p>
      )}

      {preview && (
        <div className="mt-4 rounded-[calc(var(--radius)-4px)] border border-[var(--line)] bg-[var(--bg)]">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium tabular-nums text-ink-primary">{preview.tracking_number}</span>
                <span className={cn("pill border", STATUS_PILL[preview.status_code ?? "unknown"] ?? STATUS_PILL.unknown)}>
                  {preview.description ?? preview.status ?? preview.status_code ?? "unknown"}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-ink-tertiary">
                {preview.origin ?? "?"} → {preview.destination ?? "?"} · {preview.service ?? "—"}
                {preview.pieces ? ` · ${preview.pieces} piece(s)` : ""}
              </p>
              {preview.estimated_delivery && (
                <p className="mt-0.5 text-[12px] text-ink-tertiary">ETA: {fmt(preview.estimated_delivery)}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={save}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-4px)] bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="size-3.5" />
                Save to shipments
              </button>
              <button
                onClick={() => setPreview(null)}
                className="rounded-[calc(var(--radius)-4px)] p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--hover)]"
                aria-label="Dismiss"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <ol className="max-h-72 overflow-y-auto p-4">
            {preview.events.map((e, i) => (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className={cn("mt-1 size-2 rounded-full", i === 0 ? "bg-[var(--accent)]" : "bg-[var(--muted-2)]")} />
                  {i < preview.events.length - 1 && <span className="w-px flex-1 bg-[var(--line)]" />}
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
            {preview.events.length === 0 && (
              <li className="text-[12px] text-ink-tertiary">No tracking events yet.</li>
            )}
          </ol>
        </div>
      )}
    </div>
  );
}
