"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import { createShipmentAction, type CreateShipmentState } from "./actions";
import {
  PACKAGE_PRESETS,
  DEFAULT_PACKAGE_PRESET,
  SHIPPER_PRESET,
  RECEIVER_PRESET,
  ITEM_PRESET,
} from "@/lib/shipping/dhl-presets";

const initial: CreateShipmentState = { ok: false, error: null };

const inputCls =
  "w-full rounded-[calc(var(--radius)-4px)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]";

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = true,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
        {label}{!required && " (optional)"}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        step={type === "number" ? "any" : undefined}
        className={inputCls}
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{title}</h2>
      {children}
    </section>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[var(--accent)] px-5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(15,20,25,0.10)] transition-all hover:-translate-y-px hover:bg-[#0a3a6a] disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {pending ? "Creating at DHL…" : "Confirm & create shipment"}
    </button>
  );
}

export type ShippableSubOrder = {
  id: string;
  subOrderNumber: string;
  productTitle: string;
  status: string;
  customerName: string;
  /** Without a phone we cannot notify that customer, so the row warns. */
  hasPhone: boolean;
};

/**
 * Which customer orders are inside this consignment. This is what makes DHL
 * status notifications possible — each selected sub-order's customer gets the
 * WhatsApp updates as the shipment moves.
 */
function ContentsPicker({ shippable }: { shippable: ShippableSubOrder[] }) {
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<Set<string>>(new Set());

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shippable;
    return shippable.filter((s) =>
      `${s.subOrderNumber} ${s.productTitle} ${s.customerName}`.toLowerCase().includes(q),
    );
  }, [shippable, query]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const missingPhone = shippable.filter((s) => picked.has(s.id) && !s.hasPhone).length;

  return (
    <Section title={`Orders in this shipment — ${picked.size} selected`}>
      {/* The selection travels with the form submit. */}
      {[...picked].map((id) => (
        <input key={id} type="hidden" name="subOrderIds" value={id} />
      ))}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search order number, item or customer…"
        className={`${inputCls} mb-3`}
      />

      {missingPhone > 0 && (
        <p className="mb-2 text-[12px] text-[var(--amber)]">
          {missingPhone} selected order{missingPhone !== 1 ? "s have" : " has"} no phone number — those
          customers will not receive shipment updates.
        </p>
      )}

      <div className="max-h-72 overflow-y-auto rounded-[calc(var(--radius)-4px)] border border-[var(--line)]">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-[13px] text-[var(--muted)]">No matching orders.</p>
        ) : (
          filtered.map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-center gap-3 border-b border-[var(--line)] px-3 py-2 last:border-b-0 hover:bg-[var(--hover)]"
            >
              <input
                type="checkbox"
                checked={picked.has(s.id)}
                onChange={() => toggle(s.id)}
                className="size-4 shrink-0"
              />
              <span className="w-[74px] shrink-0 font-mono text-[12px] text-[var(--ink)]">{s.subOrderNumber}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink)]">{s.productTitle}</span>
              <span className="hidden w-32 shrink-0 truncate text-[12px] text-[var(--muted)] sm:block">{s.customerName}</span>
              {!s.hasPhone && <span className="shrink-0 text-[11px] text-[var(--amber)]">no phone</span>}
            </label>
          ))
        )}
      </div>
      <p className="mt-2 text-[12px] text-[var(--muted)]">
        Selected customers receive WhatsApp updates as DHL moves the shipment. You can change this
        later from the shipment page.
      </p>
    </Section>
  );
}

export function CreateShipmentForm({ shippable }: { shippable: ShippableSubOrder[] }) {
  const router = useRouter();
  const [state, formAction] = useFormState(createShipmentAction, initial);
  const [confirmed, setConfirmed] = React.useState(false);
  const [pkgKey, setPkgKey] = React.useState<keyof typeof PACKAGE_PRESETS>(DEFAULT_PACKAGE_PRESET);
  const pkg = PACKAGE_PRESETS[pkgKey];

  React.useEffect(() => {
    if (state.ok && state.trackingNumber) {
      const t = setTimeout(() => router.push("/shipments"), 1500);
      return () => clearTimeout(t);
    }
  }, [state, router]);

  if (state.ok && state.trackingNumber) {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--green)]/30 bg-[var(--green-bg)] p-5 text-[var(--green)]">
        <div className="flex items-center gap-2 font-medium">
          <Check className="h-5 w-5" /> Shipment created — tracking {state.trackingNumber}
        </div>
        <p className="mt-1 text-[13px]">Redirecting to shipments…</p>
      </div>
    );
  }

  // default planned ship time: now + 1 day, KSA offset.
  const dt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const planned = `${dt.toISOString().slice(0, 19)} GMT+03:00`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <div className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--rose)]/30 bg-[var(--rose-bg)] px-4 py-3 text-[13px] text-[var(--rose)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <Section title="Shipment">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Product</span>
            <select name="productCode" defaultValue="P" className={inputCls}>
              <option value="P">P — International (customs)</option>
              <option value="N">N — Domestic (SA→SA)</option>
            </select>
          </label>
          <Field label="Planned ship date/time" name="plannedShippingDateAndTime" defaultValue={planned} />
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Shipper">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" name="s.fullName" defaultValue={SHIPPER_PRESET.fullName} />
            <Field label="Company" name="s.companyName" defaultValue={SHIPPER_PRESET.companyName} required={false} />
            <Field label="Phone" name="s.phone" defaultValue={SHIPPER_PRESET.phone} />
            <Field label="Country code" name="s.countryCode" defaultValue={SHIPPER_PRESET.countryCode} />
            <Field label="Address line 1" name="s.addressLine1" defaultValue={SHIPPER_PRESET.addressLine1} />
            <Field label="Address line 2" name="s.addressLine2" defaultValue={SHIPPER_PRESET.addressLine2} required={false} />
            <Field label="Address line 3" name="s.addressLine3" required={false} />
            <Field label="City" name="s.cityName" defaultValue={SHIPPER_PRESET.cityName} />
            <Field label="Postal code" name="s.postalCode" defaultValue={SHIPPER_PRESET.postalCode} />
          </div>
        </Section>

        <Section title="Receiver (Saudi national address)">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" name="r.fullName" defaultValue={RECEIVER_PRESET.fullName} />
            <Field label="Company" name="r.companyName" defaultValue={RECEIVER_PRESET.companyName} required={false} />
            <Field label="Phone" name="r.phone" defaultValue={RECEIVER_PRESET.phone} />
            <Field label="Country code" name="r.countryCode" defaultValue={RECEIVER_PRESET.countryCode} />
            <Field label="Address line 1 (bldg + street)" name="r.addressLine1" defaultValue={RECEIVER_PRESET.addressLine1} />
            <Field label="Address line 2 (additional + district)" name="r.addressLine2" defaultValue={RECEIVER_PRESET.addressLine2} />
            <Field label="Address line 3 (short code)" name="r.addressLine3" defaultValue={RECEIVER_PRESET.addressLine3} required={false} />
            <Field label="City" name="r.cityName" defaultValue={RECEIVER_PRESET.cityName} />
            <Field label="Postal code" name="r.postalCode" required={false} placeholder="Saudi addresses use the short code" />
          </div>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Package">
          <label className="mb-3 flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
              Size preset
            </span>
            <select
              value={pkgKey}
              onChange={(e) => setPkgKey(e.target.value as keyof typeof PACKAGE_PRESETS)}
              className={inputCls}
            >
              {Object.entries(PACKAGE_PRESETS).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label} · {p.lengthCm} × {p.widthCm} × {p.heightCm} cm
                </option>
              ))}
            </select>
          </label>
          {/* keyed on the preset so switching it refills weight + dimensions,
              while leaving each field editable for a one-off size. */}
          <div key={pkgKey} className="grid gap-3 sm:grid-cols-2">
            <Field label="Package weight (kg)" name="packageWeight" type="number" defaultValue={String(pkg.weightKg)} />
            <Field label="Description" name="description" defaultValue={ITEM_PRESET.description} />
            <Field label="Length (cm)" name="length" type="number" defaultValue={String(pkg.lengthCm)} />
            <Field label="Width (cm)" name="width" type="number" defaultValue={String(pkg.widthCm)} />
            <Field label="Height (cm)" name="height" type="number" defaultValue={String(pkg.heightCm)} />
            <Field label="Declared value" name="declaredValue" type="number" defaultValue={String(ITEM_PRESET.declaredValue)} />
            <Field label="Currency" name="declaredValueCurrency" defaultValue={ITEM_PRESET.currency} />
          </div>
        </Section>

        <Section title="Customs line item / invoice">
          <div key={pkgKey} className="grid gap-3 sm:grid-cols-2">
            <Field label="Item description" name="itemDescription" defaultValue={ITEM_PRESET.description} />
            <Field label="HS / commodity code" name="commodityCode" placeholder="not in the spec — fill in" />
            <Field label="Quantity" name="quantity" type="number" defaultValue={String(ITEM_PRESET.quantity)} />
            <Field label="Unit price" name="priceValue" type="number" defaultValue={String(ITEM_PRESET.declaredValue)} />
            <Field label="Net weight (kg)" name="netWeight" type="number" defaultValue={String(pkg.weightKg)} />
            <Field label="Gross weight (kg) ≤ net" name="grossWeight" type="number" defaultValue={String(pkg.weightKg)} />
            <Field label="Manufacturer country" name="manufacturerCountry" placeholder="not in the spec — fill in" />
            <Field label="Invoice number" name="invoiceNumber" defaultValue="INV-001" />
            <Field label="Invoice date" name="invoiceDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
        </Section>
      </div>

      <ContentsPicker shippable={shippable} />

      <label className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--amber)]/30 bg-[var(--amber-bg)] px-4 py-3 text-[13px] text-[var(--amber)]">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="size-4" />
        I confirm this creates a REAL DHL shipment (may be billable).
      </label>

      <div className="flex items-center gap-3">
        {confirmed ? <SubmitButton /> : (
          <button type="button" disabled className="inline-flex h-10 items-center rounded-[10px] bg-[var(--muted-2)] px-5 text-[13px] font-semibold text-white opacity-60" title="Tick the confirmation first">
            Confirm & create shipment
          </button>
        )}
      </div>
    </form>
  );
}
