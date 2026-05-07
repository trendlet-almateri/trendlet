"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Loader2, AlertTriangle, Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import { updateInvoiceAction, type ActionState } from "../actions";

export type EditInvoiceInitial = {
  id: string;
  invoice_number: string;
  status: "draft" | "pending_review" | "rejected";
  language: "en" | "ar" | "bilingual";
  cost: number;
  cost_currency: string;
  markup_percent: number;
  shipment_fee: number;
  tax_percent: number;
  total_currency: string;
  items: {
    title: string;
    sku: string;
    quantity: number;
    unit_price: number;
    sub_order_id: string | null;
  }[];
};

type LineItem = EditInvoiceInitial["items"][number] & { uid: string };

const initialState: ActionState = { ok: false, error: null };
const CURRENCIES = ["SAR", "USD", "EUR", "GBP", "AED"] as const;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function EditInvoiceForm({ initial }: { initial: EditInvoiceInitial }) {
  const [items, setItems] = useState<LineItem[]>(
    initial.items.map((it) => ({ ...it, uid: uid() })),
  );
  const [cost, setCost] = useState(String(initial.cost));
  const [costCurrency, setCostCurrency] = useState(initial.cost_currency);
  const [markupPercent, setMarkupPercent] = useState(String(initial.markup_percent));
  const [shipmentFee, setShipmentFee] = useState(String(initial.shipment_fee));
  const [taxPercent, setTaxPercent] = useState(String(initial.tax_percent));
  const [totalCurrency, setTotalCurrency] = useState(initial.total_currency);

  const itemPrice = useMemo(
    () => items.reduce((s, it) => s + it.quantity * it.unit_price, 0),
    [items],
  );
  const taxAmount = useMemo(
    () => (itemPrice + Number(shipmentFee || 0)) * (Number(taxPercent || 0) / 100),
    [itemPrice, shipmentFee, taxPercent],
  );
  const total = useMemo(
    () => itemPrice + Number(shipmentFee || 0) + taxAmount,
    [itemPrice, shipmentFee, taxAmount],
  );

  const [state, dispatch] = useFormState(updateInvoiceAction, initialState);

  function addItem() {
    setItems((p) => [
      ...p,
      { uid: uid(), title: "", sku: "", quantity: 1, unit_price: 0, sub_order_id: null },
    ]);
  }
  function removeItem(uid_: string) {
    setItems((p) => p.filter((it) => it.uid !== uid_));
  }
  function updateItem(uid_: string, patch: Partial<LineItem>) {
    setItems((p) => p.map((it) => (it.uid === uid_ ? { ...it, ...patch } : it)));
  }

  // Show "Submit for review" only when meaningful (draft or rejected).
  const canSubmitForReview = initial.status === "draft" || initial.status === "rejected";

  return (
    <form action={dispatch} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={initial.id} />
      <input type="hidden" name="language" value={initial.language} />
      <input
        type="hidden"
        name="items_json"
        value={JSON.stringify(
          items.map((it) => ({
            title: it.title,
            sku: it.sku || null,
            quantity: it.quantity,
            unit_price: it.unit_price,
            sub_order_id: it.sub_order_id,
          })),
        )}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <Section
            title="Line items"
            action={
              <Button type="button" variant="secondary" size="sm" onClick={addItem}>
                <Plus className="h-3 w-3" aria-hidden /> Add item
              </Button>
            }
          >
            {items.length === 0 ? (
              <div className="rounded-md border border-dashed border-hairline px-4 py-8 text-center text-[12px] text-ink-tertiary">
                Add at least one line item.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-[1fr_120px_70px_110px_32px] gap-2 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
                  <span>Item</span>
                  <span>SKU</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Unit price</span>
                  <span />
                </div>
                {items.map((it) => (
                  <div key={it.uid} className="grid grid-cols-[1fr_120px_70px_110px_32px] gap-2">
                    <Input
                      value={it.title}
                      onChange={(e) => updateItem(it.uid, { title: e.target.value })}
                      placeholder="Item title"
                      required
                    />
                    <Input
                      value={it.sku}
                      onChange={(e) => updateItem(it.uid, { sku: e.target.value })}
                      placeholder="SKU"
                    />
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={it.quantity}
                      onChange={(e) => updateItem(it.uid, { quantity: Number(e.target.value || 1) })}
                      className="text-right"
                      required
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.unit_price}
                      onChange={(e) => updateItem(it.uid, { unit_price: Number(e.target.value || 0) })}
                      className="text-right"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(it.uid)}
                      className="flex items-center justify-center rounded-md text-ink-tertiary hover:bg-black/5 hover:text-status-danger-fg"
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Pricing">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Cost">
                <Input type="number" min={0} step="0.01" name="cost" value={cost} onChange={(e) => setCost(e.target.value)} required />
              </Field>
              <Field label="Cost ccy">
                <CurrencyPicker name="cost_currency" value={costCurrency} onChange={setCostCurrency} />
              </Field>
              <Field label="Markup %">
                <Input type="number" min={0} step="0.01" name="markup_percent" value={markupPercent} onChange={(e) => setMarkupPercent(e.target.value)} required />
              </Field>
              <Field label="Total ccy">
                <CurrencyPicker name="total_currency" value={totalCurrency} onChange={setTotalCurrency} />
              </Field>
              <Field label="Shipping">
                <Input type="number" min={0} step="0.01" name="shipment_fee" value={shipmentFee} onChange={(e) => setShipmentFee(e.target.value)} />
              </Field>
              <Field label="VAT %">
                <Input type="number" min={0} step="0.01" name="tax_percent" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
              </Field>
            </div>
          </Section>
        </div>

        <aside className="flex flex-col gap-4">
          <Section title="Totals">
            <dl className="flex flex-col gap-1.5 text-[13px]">
              <Row label="Items" value={formatCurrency(itemPrice, totalCurrency)} />
              {Number(shipmentFee) > 0 && (
                <Row label="Shipping" value={formatCurrency(Number(shipmentFee), totalCurrency)} />
              )}
              {Number(taxPercent) > 0 && (
                <Row
                  label={`VAT ${Number(taxPercent).toFixed(0)}%`}
                  value={formatCurrency(taxAmount, totalCurrency)}
                />
              )}
              <div className="my-1 border-t border-hairline" />
              <Row label="Total" value={formatCurrency(total, totalCurrency)} bold />
            </dl>
          </Section>

          <Section title="Save">
            <div className="flex flex-col gap-2">
              <SaveButton submitForReview={false} disabled={items.length === 0} />
              {canSubmitForReview && (
                <SaveButton submitForReview={true} disabled={items.length === 0} />
              )}
              {state.error && (
                <p className="flex items-start gap-1.5 text-[11px] text-status-danger-fg">
                  <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden />
                  {state.error}
                </p>
              )}
            </div>
          </Section>
        </aside>
      </div>
    </form>
  );
}

function SaveButton({
  submitForReview,
  disabled,
}: {
  submitForReview: boolean;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name="submit_for_review"
      value={submitForReview ? "true" : ""}
      variant={submitForReview ? "primary" : "secondary"}
      disabled={pending || disabled}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
        </>
      ) : submitForReview ? (
        <>
          <Send className="h-4 w-4" aria-hidden /> Save &amp; submit for review
        </>
      ) : (
        <>
          <Save className="h-4 w-4" aria-hidden /> Save changes
        </>
      )}
    </Button>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className={cn("mono text-ink-primary", bold && "font-medium")}>{value}</dd>
    </div>
  );
}

function CurrencyPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-sm border border-[rgba(0,0,0,0.08)] bg-white px-3 text-[13px] text-ink-primary focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
    >
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
