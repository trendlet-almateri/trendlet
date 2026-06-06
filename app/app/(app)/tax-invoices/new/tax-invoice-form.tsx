"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Search, Loader2, AlertTriangle, Save, Send, CheckCircle2, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import {
  searchOrdersForTax,
  getRulesForBrand,
  createTaxInvoiceAction,
  type OrderHit,
  type CreateTaxInvoiceState,
} from "./actions";
import type { PricingRule } from "@/lib/queries/tax-pricing";

const initialState: CreateTaxInvoiceState = { ok: false, error: null };

type FeeShape = {
  service_fee_net: number;
  service_fee_vat: number;
  service_fee_with_vat: number;
  shipping_customs_fee: number;
};

const ZERO_FEES: FeeShape = {
  service_fee_net: 0,
  service_fee_vat: 0,
  service_fee_with_vat: 0,
  shipping_customs_fee: 0,
};

function feesFromRule(r: PricingRule): FeeShape {
  return {
    service_fee_net: r.service_fee_net,
    service_fee_vat: r.service_fee_vat,
    service_fee_with_vat: r.service_fee_with_vat,
    shipping_customs_fee: r.shipping_customs_fee,
  };
}

export function NewTaxInvoiceForm() {
  const [order, setOrder] = useState<OrderHit | null>(null);
  // The chosen pricing rule id (null = manual entry).
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState<string>("");
  const [categoryAr, setCategoryAr] = useState<string>("");
  const [fees, setFees] = useState<FeeShape>(ZERO_FEES);

  const [state, dispatch] = useFormState(createTaxInvoiceAction, initialState);

  function pickOrder(hit: OrderHit) {
    setOrder(hit);
    if (hit.matched) {
      setRuleId(hit.matched.id);
      setBrandName(hit.matched.brand_name);
      setCategoryAr(hit.matched.category_ar);
      setFees(feesFromRule(hit.matched));
    } else {
      // No auto-match — seed the manual picker with the order's brand so the
      // admin only has to pick the category.
      setRuleId(null);
      setBrandName(hit.brand_name ?? "");
      setCategoryAr("");
      setFees(ZERO_FEES);
    }
  }

  const totalFee = fees.service_fee_with_vat + fees.shipping_customs_fee;
  const canSubmit = order != null && totalFee > 0;

  return (
    <form action={dispatch} className="flex flex-col gap-5">
      <input type="hidden" name="order_id" value={order?.order_id ?? ""} />
      <input type="hidden" name="brand_name" value={brandName} />
      <input type="hidden" name="category_ar" value={categoryAr} />
      <input type="hidden" name="pricing_rule_id" value={ruleId ?? ""} />
      <input type="hidden" name="service_fee_net" value={fees.service_fee_net} />
      <input type="hidden" name="service_fee_vat" value={fees.service_fee_vat} />
      <input type="hidden" name="service_fee_with_vat" value={fees.service_fee_with_vat} />
      <input type="hidden" name="shipping_customs_fee" value={fees.shipping_customs_fee} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* LEFT */}
        <div className="flex flex-col gap-5">
          <Section title="Order" subtitle="Search by Shopify order number.">
            <OrderTypeahead onPick={pickOrder} selected={order} />
          </Section>

          {order && (
            <Section
              title="Pricing"
              subtitle={
                order.matched
                  ? "Auto-matched from the pricing table. Override below if it's wrong."
                  : "No automatic match — pick the brand + category, or enter fees manually."
              }
            >
              {order.matched ? (
                <div className="mb-3 flex items-center gap-2 rounded-md border border-status-success-border/40 bg-status-success-bg px-3 py-2 text-[12px] text-status-success-fg">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" aria-hidden />
                  Matched: <span className="font-medium">{order.matched.brand_name}</span> ·{" "}
                  <span dir="rtl">{order.matched.category_ar}</span>
                </div>
              ) : (
                <div className="mb-3 flex items-center gap-2 rounded-md border border-status-sourcing-border/40 bg-status-sourcing-bg px-3 py-2 text-[12px] text-status-sourcing-fg">
                  <CircleHelp className="h-4 w-4 flex-shrink-0" aria-hidden />
                  No pricing rule matched this order&apos;s brand + category.
                </div>
              )}

              <ManualPricingPicker
                initialBrand={brandName}
                hintProductType={order.product_type}
                onSelectRule={(rule) => {
                  setRuleId(rule.id);
                  setBrandName(rule.brand_name);
                  setCategoryAr(rule.category_ar);
                  setFees(feesFromRule(rule));
                }}
                onManual={() => setRuleId(null)}
              />

              {/* Manual fee entry — editable only when no rule is selected. */}
              {ruleId === null && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Service net">
                    <Input
                      type="number" min={0} step="0.01"
                      value={fees.service_fee_net}
                      onChange={(e) => setFees((f) => ({ ...f, service_fee_net: Number(e.target.value || 0) }))}
                    />
                  </Field>
                  <Field label="VAT">
                    <Input
                      type="number" min={0} step="0.01"
                      value={fees.service_fee_vat}
                      onChange={(e) => setFees((f) => ({ ...f, service_fee_vat: Number(e.target.value || 0) }))}
                    />
                  </Field>
                  <Field label="Service incl. VAT">
                    <Input
                      type="number" min={0} step="0.01"
                      value={fees.service_fee_with_vat}
                      onChange={(e) => setFees((f) => ({ ...f, service_fee_with_vat: Number(e.target.value || 0) }))}
                    />
                  </Field>
                  <Field label="Shipping & customs">
                    <Input
                      type="number" min={0} step="0.01"
                      value={fees.shipping_customs_fee}
                      onChange={(e) => setFees((f) => ({ ...f, shipping_customs_fee: Number(e.target.value || 0) }))}
                    />
                  </Field>
                </div>
              )}
            </Section>
          )}
        </div>

        {/* RIGHT */}
        <aside className="flex flex-col gap-4">
          <Section title="Customer">
            {order ? (
              <div className="flex flex-col gap-1 text-[13px]">
                <span className="font-medium text-ink-primary">{order.customer_name}</span>
                <span className="mt-1 text-[11px] text-ink-tertiary">
                  Order {order.shopify_order_number}
                </span>
              </div>
            ) : (
              <div className="text-[12px] text-ink-tertiary">Pick an order to begin.</div>
            )}
          </Section>

          <Section title="Fee summary">
            <dl className="flex flex-col gap-1.5 text-[13px]">
              <Row label="Service fee (net)" value={formatCurrency(fees.service_fee_net, "SAR")} />
              <Row label="VAT (15%)" value={formatCurrency(fees.service_fee_vat, "SAR")} />
              <Row label="Service incl. VAT" value={formatCurrency(fees.service_fee_with_vat, "SAR")} />
              <Row label="Shipping & customs" value={formatCurrency(fees.shipping_customs_fee, "SAR")} />
              <div className="my-1 border-t border-hairline" />
              <Row label="Total" value={formatCurrency(totalFee, "SAR")} bold />
            </dl>
          </Section>

          <Section title="Save">
            <div className="flex flex-col gap-2">
              <SaveButton issue={false} disabled={!canSubmit} />
              <SaveButton issue={true} disabled={!canSubmit} />
              <p className="text-[11px] text-ink-tertiary">
                Both generate a PDF. &ldquo;Issue&rdquo; marks it final.
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

/* ── order typeahead ─────────────────────────────────────────────────── */

function OrderTypeahead({
  onPick,
  selected,
}: {
  onPick: (hit: OrderHit) => void;
  selected: OrderHit | null;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<OrderHit[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 1) {
      setHits([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const results = await searchOrdersForTax(q);
        setHits(results);
        setOpen(true);
      });
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder={selected ? `Order ${selected.shopify_order_number}` : "Search order number…"}
          className="pl-9"
        />
        {pending && (
          <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-tertiary" aria-hidden />
        )}
      </div>
      {open && hits.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-80 overflow-auto rounded-md border border-hairline bg-white shadow-lg">
          {hits.map((h) => (
            <button
              key={h.order_id}
              type="button"
              onClick={() => {
                onPick(h);
                setQ("");
                setHits([]);
                setOpen(false);
              }}
              className="flex w-full flex-col items-start gap-0.5 border-b border-hairline px-3 py-2 text-left last:border-b-0 hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="mono text-[12px] font-medium text-ink-primary">
                  Order {h.shopify_order_number}
                </span>
                <span className={cn("pill border text-[10px]", h.matched
                  ? "border-status-success-border/40 bg-status-success-bg text-status-success-fg"
                  : "border-status-sourcing-border/40 bg-status-sourcing-bg text-status-sourcing-fg")}>
                  {h.matched ? "matched" : "no match"}
                </span>
              </div>
              <span className="truncate text-[12px] text-ink-secondary">
                {h.customer_name}
                {h.brand_name ? ` · ${h.brand_name}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── manual pricing picker (brand → category cascade) ────────────────── */

function ManualPricingPicker({
  initialBrand,
  hintProductType,
  onSelectRule,
  onManual,
}: {
  initialBrand: string;
  /** The order's Shopify product_type, shown as a hint to guide category choice. */
  hintProductType: string | null;
  onSelectRule: (rule: PricingRule) => void;
  onManual: () => void;
}) {
  const [brand, setBrand] = useState(initialBrand);
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setBrand(initialBrand);
  }, [initialBrand]);

  function loadBrand(b: string) {
    setBrand(b);
    setShowAll(false);
    if (!b.trim()) {
      setRules([]);
      return;
    }
    startTransition(async () => {
      setRules(await getRulesForBrand(b));
    });
  }

  // Rules whose category text relates to the order's product_type — surfaced
  // first so the admin doesn't scan a long list. Never auto-selected: the admin
  // still confirms (and chooses Boutique vs Outlet / the right size).
  const hint = hintProductType?.trim() ?? "";
  const suggested = hint
    ? rules.filter(
        (r) =>
          r.category_ar.includes(hint) ||
          hint.includes(r.category_ar) ||
          (r.shopify_product_type_alias?.includes(hint) ?? false),
      )
    : [];
  const visibleRules = showAll || suggested.length === 0 ? rules : suggested;

  return (
    <div className="flex flex-col gap-3">
      {hint && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-tertiary">
          <span>Order item type:</span>
          <span className="rounded bg-black/5 px-1.5 py-0.5 font-medium text-ink-secondary" dir="auto">
            {hint}
          </span>
          {suggested.length > 0 && !showAll && (
            <span>· showing {suggested.length} likely {suggested.length === 1 ? "match" : "matches"}</span>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Brand">
          <div className="relative">
            <Input
              value={brand}
              onChange={(e) => loadBrand(e.target.value)}
              placeholder="Brand name (as in pricing table)"
            />
            {pending && (
              <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-tertiary" aria-hidden />
            )}
          </div>
        </Field>
        <Field label="Category">
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value === "__manual__") {
                onManual();
                return;
              }
              if (e.target.value === "__showall__") {
                setShowAll(true);
                return;
              }
              const rule = rules.find((r) => r.id === e.target.value);
              if (rule) onSelectRule(rule);
            }}
            className="h-9 w-full rounded-sm border border-[rgba(0,0,0,0.08)] bg-white px-3 text-[13px] text-ink-primary focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
          >
            <option value="" disabled>
              {rules.length ? "Pick a category…" : "Type a brand first"}
            </option>
            {/* Group by pricing brand so Boutique vs Outlet are distinguishable
                when one app brand resolves to multiple pricing variants. */}
            {groupByBrand(visibleRules).map(([brandLabel, brandRules]) => (
              <optgroup key={brandLabel} label={brandLabel}>
                {brandRules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.category_ar}
                    {r.gender ? ` (${r.gender})` : ""} — {formatCurrency((r.total_fee ?? r.service_fee_with_vat + r.shipping_customs_fee), "SAR")}
                  </option>
                ))}
              </optgroup>
            ))}
            {/* Escape hatch when we've narrowed to likely matches. */}
            {!showAll && suggested.length > 0 && suggested.length < rules.length && (
              <option value="__showall__">Show all {rules.length} categories…</option>
            )}
            <option value="__manual__">Enter fees manually…</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

/** Group rules by their pricing brand_name, preserving first-seen order. */
function groupByBrand(rules: PricingRule[]): [string, PricingRule[]][] {
  const groups = new Map<string, PricingRule[]>();
  for (const r of rules) {
    const list = groups.get(r.brand_name) ?? [];
    list.push(r);
    groups.set(r.brand_name, list);
  }
  return [...groups.entries()];
}

/* ── submit ──────────────────────────────────────────────────────────── */

function SaveButton({ issue, disabled }: { issue: boolean; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name="issue"
      value={issue ? "true" : ""}
      variant={issue ? "primary" : "secondary"}
      disabled={pending || disabled}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
        </>
      ) : issue ? (
        <>
          <Send className="h-4 w-4" aria-hidden /> Issue invoice
        </>
      ) : (
        <>
          <Save className="h-4 w-4" aria-hidden /> Save as draft
        </>
      )}
    </Button>
  );
}

/* ── primitives (mirror new-invoice-form.tsx) ────────────────────────── */

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
      <div className="mb-3 flex flex-col gap-0.5">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">{title}</h2>
        {subtitle && <p className="text-[11px] text-ink-tertiary">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className={cn("mono text-ink-primary", bold && "font-medium")}>{value}</dd>
    </div>
  );
}
