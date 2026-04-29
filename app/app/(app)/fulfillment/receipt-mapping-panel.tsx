"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { extractSupplierInvoiceAction } from "./extract-action";
import { mapSupplierInvoiceItemAction } from "./map-item-action";
import { createCustomerInvoiceDraftsAction } from "./create-drafts-action";
import {
  loadReceiptPanelAction,
  type PanelItem,
  type MappableSubOrder,
} from "./load-panel-action";
import { cn } from "@/lib/utils";

type PanelState =
  | { kind: "loading" }
  | { kind: "error"; error: string }
  | {
      kind: "ready";
      receipt: {
        id: string;
        ocr_state: string;
        supplier_name: string | null;
        invoice_total: number | null;
        currency: string | null;
        barcode: string | null;
      };
      items: PanelItem[];
      mappableSubOrders: MappableSubOrder[];
    };

export function ReceiptMappingPanel({
  supplierInvoiceId,
  onClose,
}: {
  supplierInvoiceId: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<PanelState>({ kind: "loading" });
  const [extracting, startExtract] = useTransition();
  const [drafting, startDraft] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Initial load — auto-extract if the receipt is still in 'uploaded'.
  useEffect(() => {
    let alive = true;
    (async () => {
      const initial = await loadReceiptPanelAction({ supplierInvoiceId });
      if (!alive) return;
      if (!initial.ok) {
        setState({ kind: "error", error: initial.error });
        return;
      }
      // Auto-trigger extraction once if the receipt hasn't been processed.
      if (
        initial.receipt.ocr_state === "uploaded" ||
        initial.receipt.ocr_state === "extracting"
      ) {
        startExtract(async () => {
          const result = await extractSupplierInvoiceAction({
            supplierInvoiceId,
          });
          if (!result.ok) {
            setState({ kind: "error", error: result.error });
            return;
          }
          const reload = await loadReceiptPanelAction({ supplierInvoiceId });
          if (!alive) return;
          if (!reload.ok) {
            setState({ kind: "error", error: reload.error });
            return;
          }
          setState({ kind: "ready", ...reload });
        });
        return;
      }
      setState({ kind: "ready", ...initial });
    })();
    return () => {
      alive = false;
    };
  }, [supplierInvoiceId]);

  const refresh = async () => {
    const reload = await loadReceiptPanelAction({ supplierInvoiceId });
    if (!reload.ok) {
      setState({ kind: "error", error: reload.error });
      return;
    }
    setState({ kind: "ready", ...reload });
  };

  const setMapping = async (itemId: string, subOrderId: string | null) => {
    setActionMessage(null);
    const res = await mapSupplierInvoiceItemAction({ itemId, subOrderId });
    if (!res.ok) {
      setActionMessage(res.error);
      return;
    }
    await refresh();
  };

  const createDrafts = () => {
    setActionMessage(null);
    startDraft(async () => {
      const res = await createCustomerInvoiceDraftsAction({ supplierInvoiceId });
      if (!res.ok) {
        setActionMessage(res.error);
        return;
      }
      setActionMessage(
        `Created ${res.draftsCreated} draft${res.draftsCreated === 1 ? "" : "s"}. Admin can review at /invoices.`,
      );
      await refresh();
    });
  };

  return (
    <div className="basis-full">
      <div className="rounded-md border border-hairline-strong bg-neutral-50/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[12px] text-ink-secondary">
            <Sparkles className="h-3.5 w-3.5 text-ink-tertiary" aria-hidden />
            <span className="font-medium text-ink-primary">Receipt</span>
            {state.kind === "ready" && state.receipt.supplier_name && (
              <>
                <span>·</span>
                <span>{state.receipt.supplier_name}</span>
              </>
            )}
            {state.kind === "ready" &&
              state.receipt.invoice_total !== null &&
              state.receipt.currency && (
                <>
                  <span>·</span>
                  <span className="tabular-nums">
                    {fmtMoney(state.receipt.invoice_total, state.receipt.currency)}
                  </span>
                </>
              )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-tertiary hover:bg-neutral-100"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        {(state.kind === "loading" || extracting) && (
          <div className="flex items-center gap-2 px-2 py-3 text-[12px] text-ink-tertiary">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>
              {extracting ? "Extracting line items…" : "Loading receipt…"}
            </span>
          </div>
        )}

        {state.kind === "error" && (
          <div className="flex items-start gap-2 rounded-md border border-status-danger-border/40 bg-status-danger-bg/40 px-3 py-2 text-[12px] text-status-danger-fg">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
            <span>{state.error}</span>
          </div>
        )}

        {state.kind === "ready" && !extracting && (
          <>
            {state.items.length === 0 ? (
              <div className="px-2 py-3 text-[12px] text-ink-tertiary">
                No line items extracted.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {state.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    subOrders={state.mappableSubOrders}
                    onChange={(soId) => setMapping(item.id, soId)}
                  />
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-2">
              <span className="text-[11px] text-ink-tertiary">
                {state.items.filter((i) => i.mapped_sub_order_id).length} of{" "}
                {state.items.length} mapped
              </span>
              <button
                type="button"
                onClick={createDrafts}
                disabled={
                  drafting ||
                  state.items.filter((i) => i.mapped_sub_order_id).length === 0
                }
                className="inline-flex h-7 items-center gap-1 rounded-md bg-[#0f1419] px-3 text-[11px] font-medium text-white transition-colors hover:bg-[#1a2128] disabled:opacity-50"
              >
                {drafting ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                )}
                Create customer invoice drafts
              </button>
            </div>

            {actionMessage && (
              <div className="mt-2 text-[11px] text-ink-secondary">
                {actionMessage}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  subOrders,
  onChange,
}: {
  item: PanelItem;
  subOrders: MappableSubOrder[];
  onChange: (subOrderId: string | null) => void;
}) {
  const conf = item.ai_confidence;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-hairline bg-surface px-3 py-2 text-[12px]">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium text-ink-primary truncate">
          {item.description}
        </span>
        <span className="text-[11px] text-ink-tertiary">
          Qty {item.quantity} · {fmtNumber(item.unit_price)} ea ·{" "}
          <span className="tabular-nums">{fmtNumber(item.line_total)}</span>
          {conf && (
            <>
              {" · "}
              <span
                className={cn(
                  conf === "high" && "text-status-delivered-fg",
                  conf === "medium" && "text-status-sourcing-fg",
                  conf === "low" && "text-status-danger-fg",
                )}
              >
                AI: {conf}
              </span>
            </>
          )}
        </span>
      </div>
      <select
        value={item.mapped_sub_order_id ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        className="h-7 rounded-md border border-hairline bg-surface px-2 text-[11px] text-ink-primary focus:outline-none focus:ring-2 focus:ring-ink-primary/20"
      >
        <option value="">— Map to sub-order —</option>
        {subOrders.map((so) => (
          <option key={so.id} value={so.id}>
            {so.sub_order_number} · {truncate(so.product_title, 32)}
            {so.brand_name ? ` · ${so.brand_name}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function fmtNumber(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtMoney(n: number, currency: string): string {
  try {
    return n.toLocaleString("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${fmtNumber(n)} ${currency}`;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
