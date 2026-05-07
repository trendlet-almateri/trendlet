"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Search, Plus, X, Loader2, AlertTriangle, Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import {
  searchSubOrders,
  createInvoiceAction,
  type SubOrderSearchHit,
  type CreateInvoiceState,
} from "./actions";

type LineItem = {
  uid: string;
  title: string;
  sku: string;
  quantity: number;
  unit_price: number;
  sub_order_id: string | null;
};

type SelectedSubOrder = SubOrderSearchHit;

const initialState: CreateInvoiceState = { ok: false, error: null };

const CURRENCIES = ["SAR", "USD", "EUR", "GBP", "AED"] as const;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function NewInvoiceForm() {
  /* ── selected sub-orders + customer (locked once first one picked) ── */
  const [selected, setSelected] = useState<SelectedSubOrder[]>([]);
  const customer = selected[0] ?? null;

  /* ── line items ── */
  const [items, setItems] = useState<LineItem[]>([]);

  /* ── pricing inputs ── */
  const [cost, setCost] = useState<string>("0");
  const [costCurrency, setCostCurrency] = useState<string>("USD");
  const [markupPercent, setMarkupPercent] = useState<string>("0");
  const [shipmentFee, setShipmentFee] = useState<string>("0");
  const [discountAmount, setDiscountAmount] = useState<string>("0");
  // Default 0 — Shopify totals are typically tax-inclusive. Admin can opt in.
  const [taxPercent, setTaxPercent] = useState<string>("0");
  const [totalCurrency, setTotalCurrency] = useState<string>("SAR");
  const [language] = useState<"en" | "ar" | "bilingual">("en");

  /* ── derived totals ── */
  const itemPrice = useMemo(
    () => items.reduce((s, it) => s + it.quantity * it.unit_price, 0),
    [items],
  );
  const discount = useMemo(
    () => Math.min(Number(discountAmount || 0), itemPrice),
    [discountAmount, itemPrice],
  );
  const discountedItems = useMemo(() => itemPrice - discount, [itemPrice, discount]);
  const taxAmount = useMemo(
    () => (discountedItems + Number(shipmentFee || 0)) * (Number(taxPercent || 0) / 100),
    [discountedItems, shipmentFee, taxPercent],
  );
  const total = useMemo(
    () => discountedItems + Number(shipmentFee || 0) + taxAmount,
    [discountedItems, shipmentFee, taxAmount],
  );

  /* ── form action wiring ── */
  const [state, dispatch] = useFormState(createInvoiceAction, initialState);

  function addSubOrder(hit: SubOrderSearchHit) {
    // Same-customer enforcement
    if (customer && hit.customer_id !== customer.customer_id) {
      alert(
        `Can't bundle: this sub-order is for a different customer (${hit.customer_name}). All sub-orders on one invoice must share the same customer.`,
      );
      return;
    }
    if (selected.some((s) => s.sub_order_id === hit.sub_order_id)) return;

    setSelected((prev) => [...prev, hit]);
    // Auto-add a line item from the picked sub-order. Admin can edit/remove.
    setItems((prev) => [
      ...prev,
      {
        uid: uid(),
        title: hit.product_title,
        sku: hit.sku ?? "",
        quantity: hit.quantity,
        unit_price: hit.unit_price,
        sub_order_id: hit.sub_order_id,
      },
    ]);

    // Roll up Shopify line-item discounts as we accumulate sub-orders.
    if (hit.discount > 0) {
      setDiscountAmount((prev) =>
        (Number(prev || 0) + hit.discount).toFixed(2),
      );
    }

    // First pick: pre-fill currency from order's sub-order currency.
    if (selected.length === 0) {
      setCostCurrency(hit.currency);
      // Total currency stays SAR (default Trendlet billing currency).
    }
  }

  function removeSubOrder(subOrderId: string) {
    const removed = selected.find((s) => s.sub_order_id === subOrderId);
    setSelected((prev) => prev.filter((s) => s.sub_order_id !== subOrderId));
    setItems((prev) => prev.filter((it) => it.sub_order_id !== subOrderId));
    if (removed && removed.discount > 0) {
      setDiscountAmount((prev) =>
        Math.max(0, Number(prev || 0) - removed.discount).toFixed(2),
      );
    }
  }

  function addBlankItem() {
    setItems((prev) => [
      ...prev,
      { uid: uid(), title: "", sku: "", quantity: 1, unit_price: 0, sub_order_id: null },
    ]);
  }
  function removeItem(uid_: string) {
    setItems((prev) => prev.filter((it) => it.uid !== uid_));
  }
  function updateItem(uid_: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => (it.uid === uid_ ? { ...it, ...patch } : it)));
  }

  return (
    <form action={dispatch} className="flex flex-col gap-5">
      {/* Hidden serialized fields the server action reads */}
      <input type="hidden" name="order_id" value={customer?.order_id ?? ""} />
      <input
        type="hidden"
        name="sub_order_ids_json"
        value={JSON.stringify(selected.map((s) => s.sub_order_id))}
      />
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
      <input type="hidden" name="language" value={language} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* ── LEFT column ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          {/* Sub-order picker */}
          <Section title="Sub-orders" subtitle="Search by sub-order number or product title.">
            <SubOrderTypeahead onPick={addSubOrder} disabledIds={selected.map((s) => s.sub_order_id)} />
            {selected.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                {selected.map((s) => (
                  <div
                    key={s.sub_order_id}
                    className="flex items-center justify-between rounded-md border border-hairline bg-surface px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-col">
                      <div className="flex items-center gap-2">
                        <span className="mono text-[12px] font-medium text-ink-primary">
                          {s.sub_order_number}
                        </span>
                        <span className="text-[11px] text-ink-tertiary">
                          Order {s.shopify_order_number}
                        </span>
                      </div>
                      <span className="truncate text-[12px] text-ink-secondary">
                        {s.product_title}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSubOrder(s.sub_order_id)}
                      className="rounded-md p-1 text-ink-tertiary hover:bg-black/5 hover:text-ink-primary"
                      aria-label="Remove sub-order"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Line items */}
          <Section
            title="Line items"
            subtitle="Auto-filled from the sub-orders above. Edit titles, qty, and unit price."
            action={
              <Button type="button" variant="secondary" size="sm" onClick={addBlankItem}>
                <Plus className="h-3 w-3" aria-hidden /> Add item
              </Button>
            }
          >
            {items.length === 0 ? (
              <div className="rounded-md border border-dashed border-hairline px-4 py-8 text-center text-[12px] text-ink-tertiary">
                Pick a sub-order above, or add a blank line.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {/* header row */}
                <div className="grid grid-cols-[1fr_120px_70px_110px_32px] gap-2 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
                  <span>Item</span>
                  <span>SKU</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Unit price</span>
                  <span />
                </div>
                {items.map((it) => (
                  <div
                    key={it.uid}
                    className="grid grid-cols-[1fr_120px_70px_110px_32px] gap-2"
                  >
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
                      onChange={(e) =>
                        updateItem(it.uid, { unit_price: Number(e.target.value || 0) })
                      }
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

          {/* Pricing */}
          <Section title="Pricing">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Cost">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  name="cost"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  required
                />
              </Field>
              <Field label="Cost ccy">
                <CurrencyPicker name="cost_currency" value={costCurrency} onChange={setCostCurrency} />
              </Field>
              <Field label="Markup %">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  name="markup_percent"
                  value={markupPercent}
                  onChange={(e) => setMarkupPercent(e.target.value)}
                  required
                />
              </Field>
              <Field label="Total ccy">
                <CurrencyPicker name="total_currency" value={totalCurrency} onChange={setTotalCurrency} />
              </Field>
              <Field label="Discount">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  name="discount_amount"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                />
              </Field>
              <Field label="Shipping">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  name="shipment_fee"
                  value={shipmentFee}
                  onChange={(e) => setShipmentFee(e.target.value)}
                />
              </Field>
              <Field label="VAT %">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  name="tax_percent"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                />
              </Field>
            </div>
            {discount > 0 && (
              <p className="mt-2 text-[11px] text-ink-tertiary">
                Pulled from Shopify order discount allocations. Edit if needed.
              </p>
            )}
          </Section>
        </div>

        {/* ── RIGHT rail ─────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-4">
          {/* Customer */}
          <Section title="Customer">
            {customer ? (
              <div className="flex flex-col gap-1 text-[13px]">
                <span className="font-medium text-ink-primary">{customer.customer_name}</span>
                {customer.customer_email && (
                  <span className="text-ink-secondary">{customer.customer_email}</span>
                )}
                <span className="mt-1 text-[11px] text-ink-tertiary">
                  Order {customer.shopify_order_number}
                </span>
              </div>
            ) : (
              <div className="text-[12px] text-ink-tertiary">
                Pick a sub-order to fetch the customer.
              </div>
            )}
          </Section>

          {/* Totals */}
          <Section title="Totals">
            <dl className="flex flex-col gap-1.5 text-[13px]">
              <Row label="Items" value={formatCurrency(itemPrice, totalCurrency)} />
              {discount > 0 && (
                <Row
                  label="Discount"
                  value={`− ${formatCurrency(discount, totalCurrency)}`}
                />
              )}
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

          {/* Submit */}
          <Section title="Save">
            <div className="flex flex-col gap-2">
              <SaveButton submitForReview={false} disabled={selected.length === 0 || items.length === 0} />
              <SaveButton submitForReview={true} disabled={selected.length === 0 || items.length === 0} />
              <p className="text-[11px] text-ink-tertiary">
                Drafts can be edited later. Submit lands it in admin&apos;s pending-review queue.
              </p>
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

/* ── Typeahead ──────────────────────────────────────────────────────── */

function SubOrderTypeahead({
  onPick,
  disabledIds,
}: {
  onPick: (hit: SubOrderSearchHit) => void;
  disabledIds: string[];
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SubOrderSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced search.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const results = await searchSubOrders(q);
        setHits(results);
        setOpen(true);
      });
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder="Search sub-order number or product…"
          className="pl-9"
        />
        {pending && (
          <Loader2
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-tertiary"
            aria-hidden
          />
        )}
      </div>
      {open && hits.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-80 overflow-auto rounded-md border border-hairline bg-white shadow-lg">
          {hits.map((h) => {
            const disabled = disabledIds.includes(h.sub_order_id);
            return (
              <button
                key={h.sub_order_id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onPick(h);
                  setQ("");
                  setHits([]);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 border-b border-hairline px-3 py-2 text-left last:border-b-0",
                  disabled
                    ? "opacity-40"
                    : "hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none",
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="mono text-[12px] font-medium text-ink-primary">
                    {h.sub_order_number}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-ink-tertiary">
                    Order {h.shopify_order_number}
                  </span>
                </div>
                <span className="truncate text-[12px] text-ink-secondary">
                  {h.product_title}
                </span>
                <span className="text-[11px] text-ink-tertiary">
                  {h.customer_name}
                  {h.customer_email ? ` · ${h.customer_email}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Submit button (one form, two actions via hidden flag) ──────────── */

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
          <Send className="h-4 w-4" aria-hidden /> Submit for review
        </>
      ) : (
        <>
          <Save className="h-4 w-4" aria-hidden /> Save as draft
        </>
      )}
    </Button>
  );
}

/* ── primitives ─────────────────────────────────────────────────────── */

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
            {title}
          </h2>
          {subtitle && <p className="text-[11px] text-ink-tertiary">{subtitle}</p>}
        </div>
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
