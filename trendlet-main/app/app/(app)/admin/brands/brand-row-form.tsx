"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { Loader2, Save, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  updateBrandAction,
  removeBrandAction,
  type BrandActionState,
} from "./actions";
import type { BrandRow, AssigneeOption } from "@/lib/queries/brands";

const initialState: BrandActionState = { ok: false, error: null };

export function BrandRowForm({
  brand,
  assignees,
}: {
  brand: BrandRow;
  assignees: AssigneeOption[];
}) {
  const [name, setName] = useState<string>(brand.name);
  const [region, setRegion] = useState<string>(brand.region ?? "");
  const [markup, setMarkup] = useState<string>(brand.markup_percent.toString());
  const [assigneeId, setAssigneeId] = useState<string>(
    brand.primary_assignee?.user_id ?? "",
  );

  const isDirty =
    name !== brand.name ||
    region !== (brand.region ?? "") ||
    markup !== brand.markup_percent.toString() ||
    assigneeId !== (brand.primary_assignee?.user_id ?? "");

  return (
    <div
      id={`brand-row-${brand.id}`}
      className="grid grid-cols-[1.5fr_0.7fr_0.7fr_1.4fr_auto_auto] items-center gap-3 rounded-md border border-hairline bg-surface p-3 scroll-mt-24"
    >
      <SaveForm
        brand={brand}
        name={name}
        setName={setName}
        region={region}
        setRegion={setRegion}
        markup={markup}
        setMarkup={setMarkup}
        assigneeId={assigneeId}
        setAssigneeId={setAssigneeId}
        assignees={assignees}
        isDirty={isDirty}
      />
      <RemoveForm brandId={brand.id} brandName={brand.name} />
    </div>
  );
}

function SaveForm({
  brand,
  name,
  setName,
  region,
  setRegion,
  markup,
  setMarkup,
  assigneeId,
  setAssigneeId,
  assignees,
  isDirty,
}: {
  brand: BrandRow;
  name: string;
  setName: (v: string) => void;
  region: string;
  setRegion: (v: string) => void;
  markup: string;
  setMarkup: (v: string) => void;
  assigneeId: string;
  setAssigneeId: (v: string) => void;
  assignees: AssigneeOption[];
  isDirty: boolean;
}) {
  const [state, dispatch] = useFormState(updateBrandAction, initialState);

  return (
    <form action={dispatch} className="contents">
      <input type="hidden" name="brand_id" value={brand.id} />

      <input
        name="name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={120}
        className="rounded-md border border-hairline bg-surface px-2 py-1.5 text-[13px] font-medium text-ink-primary focus:outline-none focus:ring-2 focus:ring-navy/20"
      />

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

      <div className="flex items-center gap-1.5 justify-self-end">
        <SaveButton dirty={isDirty} />
        {state.error && (
          <span
            className="flex items-center gap-1 text-[11px] text-status-danger-fg"
            title={state.error}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden /> Failed
          </span>
        )}
        {state.ok && !isDirty && (
          <span className="flex items-center gap-1 text-[11px] text-status-success-fg">
            <CheckCircle2 className="h-3 w-3" aria-hidden /> Saved
          </span>
        )}
      </div>
    </form>
  );
}

function SaveButton({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  const disabled = pending || !dirty;
  return (
    <Button
      variant="secondary"
      type="submit"
      disabled={disabled}
      className="h-7 px-2 text-[11px]"
    >
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

function RemoveForm({
  brandId,
  brandName,
}: {
  brandId: string;
  brandName: string;
}) {
  const [, dispatch] = useFormState(removeBrandAction, initialState);

  return (
    <form
      action={dispatch}
      className="justify-self-end"
      onSubmit={(e) => {
        if (
          !confirm(
            `Delete brand "${brandName}"? Existing orders keep their history but will land in /orders/unassigned. This brand will disappear from all dropdowns.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="brand_id" value={brandId} />
      <RemoveSubmit />
    </form>
  );
}

function RemoveSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button
      variant="secondary"
      type="submit"
      disabled={pending}
      className="h-7 px-2 text-[11px] !text-status-danger-fg hover:!bg-status-danger-bg"
      title="Remove brand"
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="h-3 w-3" aria-hidden />
      )}
    </Button>
  );
}
