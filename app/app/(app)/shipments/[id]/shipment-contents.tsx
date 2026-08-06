"use client";

import * as React from "react";
import { Check, Loader2, Plus, Send, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MESSAGE_LABELS, type CustomerMessageKey } from "@/lib/shipping/dhl-customer-messages";
import type { ShippableSubOrder } from "../create/create-shipment-form";
import {
  addOrdersToShipmentAction,
  removeOrderFromShipmentAction,
  sendMilestoneAction,
} from "./actions";

/** The six on the normal delivery path; the two delay messages are separate. */
const JOURNEY: CustomerMessageKey[] = [
  "picked_up", "usa_processing", "departed_usa", "arrived_ksa", "customs_cleared", "at_trendlet_hq",
];
const DELAYS: CustomerMessageKey[] = ["delay_after_customs", "delay_3days"];

export type ShipmentContent = {
  subOrderId: string;
  subOrderNumber: string;
  productTitle: string;
  customerName: string;
  hasPhone: boolean;
  sent: Record<string, string>; // message key -> ISO sent_at
};

const btn =
  "inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-4px)] border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--hover)] disabled:opacity-50";

function MilestoneButton({
  shipmentId, subOrderId, msgKey, sentAt, disabled, onDone,
}: {
  shipmentId: string; subOrderId: string; msgKey: CustomerMessageKey;
  sentAt?: string; disabled: boolean; onDone: (err: string | null) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const label = MESSAGE_LABELS[msgKey];

  if (sentAt) {
    return (
      <span
        title={`Sent ${new Date(sentAt).toLocaleString()}`}
        className="inline-flex items-center gap-1 rounded-full border border-[var(--green)]/30 bg-[var(--green-bg)] px-2 py-0.5 text-[11px] text-[var(--green)]"
      >
        <Check className="size-3" /> {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy || disabled}
      title={disabled ? "This customer has no usable phone number" : `Send “${label}” now`}
      onClick={async () => {
        setBusy(true);
        const res = await sendMilestoneAction(shipmentId, subOrderId, msgKey);
        setBusy(false);
        onDone(res.ok ? null : res.error);
      }}
      className={cn(btn, "rounded-full px-2 py-0.5 text-[11px]")}
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
      {label}
    </button>
  );
}

export function ShipmentContents({
  shipmentId, contents, shippable,
}: {
  shipmentId: string;
  contents: ShipmentContent[];
  shippable: ShippableSubOrder[];
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [busyRow, setBusyRow] = React.useState<string | null>(null);

  const already = new Set(contents.map((c) => c.subOrderId));
  const candidates = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return shippable
      .filter((s) => !already.has(s.id))
      .filter((s) => !q || `${s.subOrderNumber} ${s.productTitle} ${s.customerName}`.toLowerCase().includes(q));
  }, [shippable, query, contents]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--rose)]/30 bg-[var(--rose-bg)] px-4 py-3 text-[13px] text-[var(--rose)]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {contents.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-[var(--line)] px-4 py-6 text-[13px] text-[var(--muted)]">
          No orders are attached, so nobody will be notified about this shipment. Add them below.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {contents.map((c) => (
            <article key={c.subOrderId} className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4">
              <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-[12px] text-[var(--ink)]">{c.subOrderNumber}</span>
                <span className="text-[13px] text-[var(--ink)]">{c.productTitle}</span>
                <span className="text-[12px] text-[var(--muted)]">· {c.customerName}</span>
                {!c.hasPhone && (
                  <span className="text-[11px] text-[var(--amber)]">no phone — cannot be notified</span>
                )}
                <button
                  type="button"
                  disabled={busyRow === c.subOrderId}
                  onClick={async () => {
                    setBusyRow(c.subOrderId);
                    const res = await removeOrderFromShipmentAction(shipmentId, c.subOrderId);
                    setBusyRow(null);
                    setError(res.ok ? null : res.error);
                  }}
                  className={cn(btn, "ml-auto")}
                  title="Remove this order from the shipment"
                >
                  <Trash2 className="size-3.5" /> Remove
                </button>
              </header>

              <div className="flex flex-wrap gap-1.5">
                {JOURNEY.map((k) => (
                  <MilestoneButton
                    key={k}
                    shipmentId={shipmentId}
                    subOrderId={c.subOrderId}
                    msgKey={k}
                    sentAt={c.sent[k]}
                    disabled={!c.hasPhone}
                    onDone={setError}
                  />
                ))}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">If delayed</span>
                {DELAYS.map((k) => (
                  <MilestoneButton
                    key={k}
                    shipmentId={shipmentId}
                    subOrderId={c.subOrderId}
                    msgKey={k}
                    sentAt={c.sent[k]}
                    disabled={!c.hasPhone}
                    onDone={setError}
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ── attach more orders ───────────────────────────────────────── */}
      {!adding ? (
        <button type="button" onClick={() => setAdding(true)} className={cn(btn, "self-start")}>
          <Plus className="size-3.5" /> Add orders
        </button>
      ) : (
        <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Add orders — {picked.size} selected
          </h3>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order number, item or customer…"
            className="mb-3 w-full rounded-[calc(var(--radius)-4px)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
          <div className="max-h-64 overflow-y-auto rounded-[calc(var(--radius)-4px)] border border-[var(--line)]">
            {candidates.length === 0 ? (
              <p className="px-3 py-4 text-[13px] text-[var(--muted)]">No matching orders.</p>
            ) : (
              candidates.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-[var(--line)] px-3 py-2 last:border-b-0 hover:bg-[var(--hover)]"
                >
                  <input
                    type="checkbox"
                    checked={picked.has(s.id)}
                    onChange={() =>
                      setPicked((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                        return next;
                      })
                    }
                    className="size-4 shrink-0"
                  />
                  <span className="w-[74px] shrink-0 font-mono text-[12px]">{s.subOrderNumber}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{s.productTitle}</span>
                  <span className="hidden w-32 shrink-0 truncate text-[12px] text-[var(--muted)] sm:block">{s.customerName}</span>
                  {!s.hasPhone && <span className="shrink-0 text-[11px] text-[var(--amber)]">no phone</span>}
                </label>
              ))
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={picked.size === 0 || busyRow === "add"}
              onClick={async () => {
                setBusyRow("add");
                const res = await addOrdersToShipmentAction(shipmentId, [...picked]);
                setBusyRow(null);
                if (res.ok) { setPicked(new Set()); setAdding(false); setError(null); }
                else setError(res.error);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-[var(--accent)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#0a3a6a] disabled:opacity-50"
            >
              {busyRow === "add" && <Loader2 className="size-4 animate-spin" />}
              Add {picked.size > 0 ? picked.size : ""}
            </button>
            <button type="button" onClick={() => { setAdding(false); setPicked(new Set()); }} className={btn}>
              Cancel
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
