"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Loader2, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBrandAction, type BrandActionState } from "./actions";
import type { OrphanBrand } from "@/lib/queries/brands";

const initialState: BrandActionState = { ok: false, error: null };

export function OrphanBrandsPanel({ orphans }: { orphans: OrphanBrand[] }) {
  if (orphans.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-md border border-status-warning-border bg-status-warning-bg p-3">
      <header className="flex flex-col gap-0.5">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-status-warning-fg">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Unknown brands from Shopify ({orphans.length})
        </h2>
        <span className="text-[11px] text-ink-secondary">
          These brand names appeared on incoming orders but aren&apos;t in your system. Click <strong>Create</strong> to add them — orders will auto-link as soon as the brand exists.
        </span>
      </header>

      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-[1.5fr_0.6fr_auto] items-center gap-3 px-2 text-[10px] font-medium uppercase tracking-[0.4px] text-ink-tertiary">
          <span>Brand name (from Shopify)</span>
          <span>Orders waiting</span>
          <span className="justify-self-end">&nbsp;</span>
        </div>

        {orphans.map((o) => (
          <OrphanRow key={o.brand_name_raw} orphan={o} />
        ))}
      </div>
    </section>
  );
}

function OrphanRow({ orphan }: { orphan: OrphanBrand }) {
  const [state, dispatch] = useFormState(createBrandAction, initialState);

  return (
    <form
      action={dispatch}
      className="grid grid-cols-[1.5fr_0.6fr_auto] items-center gap-3 rounded-md border border-hairline bg-surface px-2 py-1.5"
    >
      <input type="hidden" name="name" value={orphan.brand_name_raw} />
      <input type="hidden" name="region" value="" />
      <input type="hidden" name="markup_percent" value="0" />
      <input type="hidden" name="primary_assignee_id" value="" />

      <span className="text-[13px] font-medium text-ink-primary">
        {orphan.brand_name_raw}
      </span>
      <span className="text-[12px] tabular-nums text-ink-secondary">
        {orphan.sub_order_count}
      </span>

      <div className="flex items-center gap-1.5 justify-self-end">
        <CreateButton />
        {state.error && (
          <span
            className="flex items-center gap-1 text-[11px] text-status-danger-fg"
            title={state.error}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden /> {state.error}
          </span>
        )}
      </div>
    </form>
  );
}

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <Button variant="primary" type="submit" disabled={pending} className="h-7 px-2 text-[11px]">
      {pending ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Creating…
        </>
      ) : (
        <>
          <Plus className="h-3 w-3" aria-hidden /> Create
        </>
      )}
    </Button>
  );
}
