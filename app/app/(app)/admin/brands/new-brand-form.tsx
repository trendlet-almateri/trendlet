"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBrandAction, type BrandActionState } from "./actions";
import type { AssigneeOption } from "@/lib/queries/brands";
import { DropdownSelect } from "@/components/ui/dropdown-select";

const initialState: BrandActionState = { ok: false, error: null };

const REGION_OPTIONS = [
  { value: "", label: "—" },
  { value: "US", label: "US" },
  { value: "EU", label: "EU" },
  { value: "KSA", label: "KSA" },
  { value: "GLOBAL", label: "GLOBAL" },
];

export function NewBrandForm({ assignees }: { assignees: AssigneeOption[] }) {
  const [state, dispatch] = useFormState(createBrandAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [region, setRegion] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setRegion("");
      setAssigneeId("");
    }
  }, [state.ok]);

  const assigneeOptions = [
    { value: "", label: "— unassigned —" },
    ...assignees.map((a) => ({
      value: a.id,
      label: `${a.full_name} (${a.roles.join(", ") || "no role"})`,
    })),
  ];

  return (
    <section className="rounded-md border border-dashed border-hairline-strong bg-neutral-50 p-3">
      <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
        <Plus className="h-3 w-3" aria-hidden /> New brand
      </h2>
      <form
        ref={formRef}
        action={dispatch}
        className="grid grid-cols-[1.5fr_0.7fr_0.7fr_1.4fr_auto] items-center gap-3"
      >
        {/* Brand name */}
        <input
          name="name"
          type="text"
          required
          maxLength={120}
          placeholder="e.g. Adidas"
          className="rounded-md border border-hairline bg-surface px-2 py-1.5 text-[13px] font-medium text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-navy/20"
        />

        {/* Region */}
        <input type="hidden" name="region" value={region} />
        <DropdownSelect
          value={region}
          onChange={setRegion}
          options={REGION_OPTIONS}
          placeholder="—"
          size="sm"
        />

        {/* Markup */}
        <div className="flex items-center gap-1">
          <input
            name="markup_percent"
            type="number"
            step="0.01"
            min="0"
            max="999.99"
            defaultValue="0"
            className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-right text-[12px] tabular-nums text-ink-primary focus:outline-none focus:ring-2 focus:ring-navy/20"
          />
          <span className="text-[11px] text-ink-tertiary">%</span>
        </div>

        {/* Assignee */}
        <input type="hidden" name="primary_assignee_id" value={assigneeId} />
        <DropdownSelect
          value={assigneeId}
          onChange={setAssigneeId}
          options={assigneeOptions}
          placeholder="— unassigned —"
          size="sm"
        />

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
    </section>
  );
}

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <Button variant="primary" type="submit" disabled={pending} className="h-7 px-3 text-[11px]">
      {pending ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Adding…
        </>
      ) : (
        <>
          <Plus className="h-3 w-3" aria-hidden /> Add brand
        </>
      )}
    </Button>
  );
}
