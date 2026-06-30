"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import { createShipmentAction, type CreateShipmentState } from "./actions";

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

export function CreateShipmentForm() {
  const router = useRouter();
  const [state, formAction] = useFormState(createShipmentAction, initial);
  const [confirmed, setConfirmed] = React.useState(false);

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
            <Field label="Full name" name="s.fullName" defaultValue="Trendlet Warehouse" />
            <Field label="Company" name="s.companyName" defaultValue="Trendlet US" required={false} />
            <Field label="Phone" name="s.phone" defaultValue="+12025550150" />
            <Field label="Country code" name="s.countryCode" defaultValue="US" />
            <Field label="Address line 1" name="s.addressLine1" defaultValue="4613 Nw 131st Ave" />
            <Field label="Address line 2" name="s.addressLine2" required={false} />
            <Field label="Address line 3" name="s.addressLine3" required={false} />
            <Field label="City" name="s.cityName" defaultValue="PORTLAND" />
            <Field label="Postal code" name="s.postalCode" defaultValue="97229" />
          </div>
        </Section>

        <Section title="Receiver (Saudi national address)">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" name="r.fullName" />
            <Field label="Company" name="r.companyName" required={false} />
            <Field label="Phone" name="r.phone" />
            <Field label="Country code" name="r.countryCode" defaultValue="SA" />
            <Field label="Address line 1 (bldg + street)" name="r.addressLine1" placeholder="2929, Raihana Bint Zaid Street" />
            <Field label="Address line 2 (additional + district)" name="r.addressLine2" placeholder="8118, AlArid" />
            <Field label="Address line 3 (short code)" name="r.addressLine3" required={false} placeholder="RRRD2929" />
            <Field label="City" name="r.cityName" defaultValue="Riyadh" />
            <Field label="Postal code" name="r.postalCode" placeholder="13337" />
          </div>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Package">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Package weight (kg)" name="packageWeight" type="number" defaultValue="0.95" />
            <Field label="Description" name="description" defaultValue="Cosmetics: Skincare" />
            <Field label="Length (cm)" name="length" type="number" defaultValue="18" />
            <Field label="Width (cm)" name="width" type="number" defaultValue="13" />
            <Field label="Height (cm)" name="height" type="number" defaultValue="13" />
            <Field label="Declared value" name="declaredValue" type="number" defaultValue="608.39" />
            <Field label="Currency" name="declaredValueCurrency" defaultValue="SAR" />
          </div>
        </Section>

        <Section title="Customs line item / invoice">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Item description" name="itemDescription" defaultValue="Skincare cream 100ml" />
            <Field label="HS / commodity code" name="commodityCode" defaultValue="33059040" />
            <Field label="Quantity" name="quantity" type="number" defaultValue="1" />
            <Field label="Unit price" name="priceValue" type="number" defaultValue="608.39" />
            <Field label="Net weight (kg)" name="netWeight" type="number" defaultValue="0.95" />
            <Field label="Gross weight (kg) ≤ net" name="grossWeight" type="number" defaultValue="0.95" />
            <Field label="Manufacturer country" name="manufacturerCountry" defaultValue="GB" />
            <Field label="Invoice number" name="invoiceNumber" defaultValue="INV-001" />
            <Field label="Invoice date" name="invoiceDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
        </Section>
      </div>

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
