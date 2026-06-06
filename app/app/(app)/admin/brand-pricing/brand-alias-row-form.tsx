"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Check, ChevronDown, Loader2, Save, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setBrandAliasesAction, type AliasActionState } from "./actions";

const initialState: AliasActionState = { ok: false, error: null };

export function BrandAliasRowForm({
  appBrand,
  current,
  viaNameMatch,
  pricingBrands,
}: {
  appBrand: string;
  current: string[];
  viaNameMatch: boolean;
  pricingBrands: string[];
}) {
  const [selected, setSelected] = useState<string[]>(viaNameMatch ? [] : current);
  const [state, dispatch] = useFormState(setBrandAliasesAction, initialState);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (state.ok) {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [state.ok]);

  function toggle(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  const dirty =
    JSON.stringify([...selected].sort()) !==
    JSON.stringify([...(viaNameMatch ? [] : current)].sort());

  return (
    <form
      action={dispatch}
      className="grid grid-cols-[1.2fr_2fr_auto] items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-3 shadow-[var(--shadow-sm)]"
    >
      <input type="hidden" name="app_brand_name" value={appBrand} />
      <input type="hidden" name="pricing_brands_json" value={JSON.stringify(selected)} />

      <div className="flex flex-col">
        <span className="text-[13px] font-medium text-[var(--ink)]">{appBrand}</span>
        {viaNameMatch && selected.length === 0 && (
          <span className="text-[11px] text-[var(--muted)]">matches by name</span>
        )}
        {!viaNameMatch && current.length === 0 && selected.length === 0 && (
          <span className="text-[11px] text-status-sourcing-fg">unmapped</span>
        )}
      </div>

      <MultiSelect options={pricingBrands} selected={selected} onToggle={toggle} />

      <div className="flex items-center gap-2 justify-self-end">
        {state.error && (
          <span className="flex items-center gap-1 text-[11px] text-status-danger-fg" title={state.error}>
            <AlertTriangle className="h-3 w-3" aria-hidden /> Failed
          </span>
        )}
        {justSaved && !dirty && (
          <span className="flex items-center gap-1 text-[11px] text-status-success-fg">
            <Check className="h-3 w-3" aria-hidden /> Saved
          </span>
        )}
        <SaveButton disabled={!dirty} />
      </div>
    </form>
  );
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending || disabled}>
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

/* ── multi-select checklist popover ──────────────────────────────────── */

function MultiSelect({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-sm border border-[rgba(0,0,0,0.08)] bg-white px-3 text-left text-[13px] text-ink-primary hover:border-navy/40 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
      >
        <span className={cn("truncate", selected.length === 0 && "text-ink-tertiary")}>
          {selected.length === 0 ? "Pick pricing brand(s)…" : selected.join(" · ")}
        </span>
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-ink-tertiary" aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-auto rounded-md border border-hairline bg-white py-1 shadow-lg">
          {options.map((name) => {
            const checked = selected.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => onToggle(name)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border",
                    checked ? "border-navy bg-navy text-white" : "border-hairline",
                  )}
                >
                  {checked && <Check className="h-3 w-3" aria-hidden />}
                </span>
                <span className="text-ink-primary">{name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
