"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { saveExtrasAndRegenerate, type MissingExtraProduct } from "./extra-actions";

/**
 * Shown when an invoice's products are missing custom.extra. One numeric field
 * per product; on save, writes each to Shopify then regenerates the PDF.
 */
export function AddExtraPanel({ invoiceId, products }: { invoiceId: string; products: MissingExtraProduct[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const extras = products
      .map((p) => ({ product_id: p.product_id, value: Number(values[p.product_id]) }))
      .filter((e) => Number.isFinite(e.value) && e.value >= 0);
    if (extras.length === 0) {
      setError("Enter an extra value for at least one product.");
      return;
    }
    setBusy(true);
    const res = await saveExtrasAndRegenerate(invoiceId, extras);
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error ?? "Failed to save");
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--amber)]/30 bg-[var(--amber-bg)] p-4">
      <div className="mb-1 text-[12.5px] font-semibold text-[var(--amber)]">Add product extra</div>
      <p className="mb-3 text-[12px] text-[var(--amber)]">
        These products have no <code>custom.extra</code> in Shopify. Enter it (shipping = extra − 70),
        save to write it back to Shopify and regenerate the invoice.
      </p>
      <div className="flex flex-col gap-2.5">
        {products.map((p) => (
          <label key={p.product_id} className="flex items-center gap-2">
            <span className="flex-1 truncate text-[12.5px] text-[var(--ink-2)]" title={p.title}>{p.title}</span>
            <input
              type="number"
              min={0}
              step="1"
              value={values[p.product_id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [p.product_id]: e.target.value }))}
              placeholder="extra"
              className="h-8 w-24 rounded-md border border-[var(--line)] bg-white px-2 text-[13px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
            />
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-[11px] text-[var(--rose)]">{error}</p>}
      <button
        onClick={save}
        disabled={busy}
        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 text-[12.5px] font-semibold text-white disabled:opacity-60"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
        {busy ? "Saving & regenerating…" : "Save & regenerate"}
      </button>
    </div>
  );
}
