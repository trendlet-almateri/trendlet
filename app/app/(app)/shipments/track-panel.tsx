"use client";

import * as React from "react";
import { Check, RefreshCw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveTrackingResultAction } from "./actions";
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

/** Add-a-tracking-number form + live DHL detail preview. Auto-saves on found. */
export function TrackPanel() {
  const [tn, setTn] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<TrackResult | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function lookup() {
    const value = tn.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    setSaved(false);
    try {
      // One DHL request: the API route. The result is reused for the
      // auto-save below, so a new lookup costs exactly 1 DHL call.
      const res = await fetch(`/api/shipments/track?trackingNumber=${encodeURIComponent(value)}`);
      const data = (await res.json()) as TrackResult;
      if (!data.found) {
        setError(data.error ?? "No shipment found");
        return;
      }
      setPreview(data);
      // Auto-save — no button, no second DHL call.
      const save = await saveTrackingResultAction(data);
      if (!save.ok) {
        setError(save.error ?? "Found, but could not save");
      } else {
        setSaved(true);
        // Refresh so the new/updated row + request count show.
        setTimeout(() => window.location.reload(), 900);
      }
    } catch {
      setError("Lookup failed — check connection");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={tn}
            onChange={(e) => setTn(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="DHL tracking number…"
            className="w-full rounded-[calc(var(--radius)-4px)] border border-[var(--line)] bg-[var(--bg)] py-1.5 pl-8 pr-3 text-[12px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]"
          />
        </div>
        <button
          onClick={lookup}
          disabled={busy || !tn.trim()}
          className="inline-flex items-center gap-1 rounded-[calc(var(--radius)-4px)] border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--hover)] disabled:opacity-50"
        >
          {busy ? <RefreshCw className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
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
              {saved && (
                <span className="inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-4px)] border border-[var(--green)]/30 bg-[var(--green-bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--green)]">
                  <Check className="size-3.5" />
                  Saved
                </span>
              )}
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
