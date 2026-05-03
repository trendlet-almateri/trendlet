"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type UnassignedRow = {
  id: string;
  sub_order_number: string;
  product_title: string;
  brand_name_raw: string | null;
  quantity: number;
  unit_price: number | null;
  currency: string;
  created_at: string;
  order: {
    id: string;
    shopify_order_number: string;
    customer: { first_name: string | null; last_name: string | null } | null;
  } | null;
};

function fmt(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function age(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type Props = { onClose: () => void };

export function UnassignedModal({ onClose }: Props) {
  const [rows, setRows] = React.useState<UnassignedRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [assigning, setAssigning] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/admin/unassigned")
      .then((r) => r.json())
      .then(({ rows }) => { setRows(rows ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  async function autoAssign(id: string) {
    setAssigning(id);
    setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    try {
      const res = await fetch("/api/admin/unassigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subOrderId: id }),
      });
      const json = await res.json();
      if (json.error) {
        setErrors((prev) => ({ ...prev, [id]: json.error }));
      } else {
        load();
      }
    } catch {
      setErrors((prev) => ({ ...prev, [id]: "Request failed" }));
    } finally {
      setAssigning(null);
    }
  }

  const content = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[rgba(15,20,25,0.5)]" style={{ animation: "backdropIn 0.2s ease forwards" }} onClick={onClose} />
      <div className="relative flex h-[580px] w-full max-w-[920px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-md)]" style={{ animation: "riseIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards" }}>

        {/* Sidebar */}
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--hover)]">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--rose)]">
              <AlertTriangle className="h-4 w-4 text-white" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-[var(--ink)]">Unassigned</span>
              <span className="text-[11px] text-[var(--muted)]">Manual triage</span>
            </div>
          </div>
          <div className="mx-3 h-px bg-[var(--line)]" />
          <div className="flex flex-col gap-2 p-4 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">What is this?</p>
            <p className="text-[12px] leading-relaxed text-[var(--muted)]">
              Sub-orders that arrived without a recognized brand mapping. Assign them manually or use Auto-assign.
            </p>
          </div>
          <div className="flex-1" />
          <div className="border-t border-[var(--line)] p-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">Pending</p>
            <p className="text-[22px] font-semibold tabular-nums text-[var(--ink)]">
              {loading ? "—" : rows.length}
              <span className="ml-1 text-[14px] text-[var(--muted)]">
                {rows.length === 1 ? "sub-order" : "sub-orders"}
              </span>
            </p>
            {!loading && rows.length > 0 && (
              <p className="mt-1 text-[11px] text-[var(--rose)]">Needs attention</p>
            )}
            {!loading && rows.length === 0 && (
              <p className="mt-1 text-[11px] text-[var(--green)]">Queue is clear</p>
            )}
          </div>
        </aside>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-start justify-between border-b border-[var(--line)] px-6 py-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--ink)]">Unassigned queue</h2>
              <p className="text-[12px] text-[var(--muted)]">Sub-orders waiting for brand assignment.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={load} disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--hover)] disabled:opacity-50">
                <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
                Refresh
              </button>
              <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Table header */}
          {!loading && rows.length > 0 && (
            <div className="grid grid-cols-[1.2fr_2fr_1fr_1fr_0.8fr_0.6fr_1fr] items-center gap-2 border-b border-[var(--line)] bg-[var(--hover)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.4px] text-[var(--muted)]">
              <span>Sub-order</span>
              <span>Product</span>
              <span>Brand (raw)</span>
              <span>Order</span>
              <span className="text-right">Value</span>
              <span>Age</span>
              <span className="text-right">Action</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-16 text-[12px] text-[var(--muted)]">Loading…</div>
            )}
            {!loading && rows.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] bg-[var(--hover)]">
                  <AlertTriangle className="h-5 w-5 text-[var(--muted)]" />
                </span>
                <p className="text-[13px] font-medium text-[var(--ink)]">Queue is empty</p>
                <p className="text-[12px] text-[var(--muted)]">All sub-orders have been assigned.</p>
              </div>
            )}
            {!loading && rows.map((r) => {
              const customerName = r.order?.customer
                ? [r.order.customer.first_name, r.order.customer.last_name].filter(Boolean).join(" ")
                : "—";
              const lineValue = r.unit_price != null ? r.unit_price * r.quantity : null;
              const isAssigning = assigning === r.id;
              return (
                <div key={r.id} className="grid grid-cols-[1.2fr_2fr_1fr_1fr_0.8fr_0.6fr_1fr] items-center gap-2 border-b border-[var(--line)] px-4 py-3 text-[13px] transition-colors hover:bg-[var(--hover)] last:border-0">
                  <span className="truncate font-medium text-[var(--ink)]">{r.sub_order_number}</span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[var(--ink)]">{r.product_title}</span>
                    <span className="text-[11px] text-[var(--muted)]">qty {r.quantity}</span>
                  </div>
                  <div>
                    {r.brand_name_raw
                      ? <span className="rounded border border-[var(--amber)]/30 bg-[var(--amber-bg)] px-1.5 py-px text-[10px] font-semibold text-[var(--amber)]">{r.brand_name_raw}</span>
                      : <span className="text-[var(--muted)]">—</span>}
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-[var(--accent)]">
                      {r.order?.shopify_order_number ?? "—"}
                    </span>
                    <span className="truncate text-[11px] text-[var(--muted)]">{customerName}</span>
                  </div>
                  <span className="text-right tabular-nums text-[var(--ink)]">
                    {lineValue != null ? fmt(lineValue, r.currency) : "—"}
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">{age(r.created_at)}</span>
                  <div className="flex flex-col items-end gap-1">
                    <button type="button" onClick={() => autoAssign(r.id)} disabled={isAssigning}
                      className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--hover)] disabled:opacity-50">
                      {isAssigning ? "Assigning…" : "Auto-assign"}
                    </button>
                    {errors[r.id] && (
                      <span className="text-[10px] text-[var(--rose)]">{errors[r.id]}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
