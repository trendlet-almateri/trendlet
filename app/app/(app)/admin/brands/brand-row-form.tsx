"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { Loader2, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateBrandAction, type BrandActionState } from "./actions";
import type { BrandRow, AssigneeOption } from "@/lib/queries/brands";

const initialState: BrandActionState = { ok: false, error: null };

const REGION_PILL: Record<string, string> = {
  US: "border-blue-300 bg-blue-50 text-blue-700",
  EU: "border-purple-300 bg-purple-50 text-purple-700",
  KSA: "border-green-300 bg-green-50 text-green-700",
  GLOBAL: "border-neutral-300 bg-neutral-50 text-neutral-700",
};

export function BrandRowForm({
  brand,
  assignees,
}: {
  brand: BrandRow;
  assignees: AssigneeOption[];
}) {
  const [state, dispatch] = useFormState(updateBrandAction, initialState);
  // Local-only state so the markup field can be edited without re-rendering
  // the whole row. Submit reads value out of the form, not this state.
  const [region, setRegion] = useState<string>(brand.region ?? "");
  const [markup, setMarkup] = useState<string>(brand.markup_percent.toString());
  const [assigneeId, setAssigneeId] = useState<string>(
    brand.primary_assignee?.user_id ?? "",
  );

  return (
    <form
      action={dispatch}
      className="grid grid-cols-[1.5fr_0.7fr_0.7fr_1.4fr_auto] items-center gap-3 rounded-md border border-hairline bg-surface p-3"
    >
      <input type="hidden" name="brand_id" value={brand.id} />

      {/* Brand name */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium text-ink-primary truncate">{brand.name}</span>
        {brand.region && (
          <span
            className={cn(
              "pill border text-[10px]",
              REGION_PILL[brand.region] ?? REGION_PILL.GLOBAL,
            )}
          >
            {brand.region}
          </span>
        )}
      </div>

      {/* Region */}
      <select
        name="region"
        value={region}
        onChange={(e) => setRegion(e.target.value)}
        className="rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12px] text-ink-primary focus:outline-none focus:ring-2 focus:ring-navy/20"
      >
        <option value="">—</option>
        <option value="US">US</option>
        <option value="EU">EU</option>
        <option value="KSA">KSA</option>
        <option value="GLOBAL">GLOBAL</option>
      </select>

      {/* Markup */}
      <div className="flex items-center gap-1">
        <input
          name="markup_percent"
          type="number"
          step="0.01"
          min="0"
          max="999.99"
          value={markup}
          onChange={(e) => setMarkup(e.target.value)}
          className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-right text-[12px] tabular-nums text-ink-primary focus:outline-none focus:ring-2 focus:ring-navy/20"
        />
        <span className="text-[11px] text-ink-tertiary">%</span>
      </div>

      {/* Assignee */}
      <select
        name="primary_assignee_id"
        value={assigneeId}
        onChange={(e) => setAssigneeId(e.target.value)}
        className="rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12px] text-ink-primary focus:outline-none focus:ring-2 focus:ring-navy/20"
      >
        <option value="">— unassigned —</option>
        {assignees.map((a) => (
          <option key={a.id} value={a.id}>
            {a.full_name} ({a.roles.join(", ") || "no role"})
          </option>
        ))}
      </select>

      {/* Save */}
      <div className="flex items-center gap-1.5 justify-self-end">
        <SaveButton />
        {state.error && (
          <span
            className="flex items-center gap-1 text-[11px] text-status-danger-fg"
            title={state.error}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden /> Failed
          </span>
        )}
        {state.ok && (
          <span className="flex items-center gap-1 text-[11px] text-status-success-fg">
            <CheckCircle2 className="h-3 w-3" aria-hidden /> Saved
          </span>
        )}
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button variant="secondary" type="submit" disabled={pending} className="h-7 px-2 text-[11px]">
      {pending ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Saving…
        </>
      ) : (
        <>
          <Save className="h-3 w-3" aria-hidden /> Save
        </>
      )}
    </Button>
  );
}
