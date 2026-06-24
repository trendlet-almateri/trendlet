"use client";

/**
 * Orders filters — one popover containing six independent filters.
 * Live-applied, combinable, persisted to URL by the caller via parseFilters /
 * serializeFilters. The orders-view owns the state; this file just renders the
 * popover and emits onChange diffs.
 */

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal, X, Check, ChevronDown, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { REGION_OPTIONS, type Region } from "@/lib/utils/region";

// ── Types ──────────────────────────────────────────────────────────────────

export type StatusBucket =
  | "all"
  | "active"
  | "delayed"
  | "completed"
  | "unassigned"
  | "cancelled";

export type OrdersFilterState = {
  status: StatusBucket;
  brands: string[];        // brand_name_raw values
  assignees: string[];     // profile ids; "__unassigned" sentinel for is_unassigned
  regions: Region[];
  dateFrom: string | null; // yyyy-mm-dd
  dateTo: string | null;
  issuesOnly: boolean;
};

export const EMPTY_FILTERS: OrdersFilterState = {
  status: "all",
  brands: [],
  assignees: [],
  regions: [],
  dateFrom: null,
  dateTo: null,
  issuesOnly: false,
};

export const UNASSIGNED_SENTINEL = "__unassigned";

const STATUS_OPTIONS: { value: StatusBucket; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "delayed", label: "Delayed" },
  { value: "completed", label: "Completed" },
  { value: "unassigned", label: "Unassigned" },
  { value: "cancelled", label: "Cancelled" },
];

// ── URL persistence helpers ────────────────────────────────────────────────
// Caller passes URLSearchParams; we round-trip the filter state.

export function parseFilters(sp: URLSearchParams): OrdersFilterState {
  const arr = (key: string) =>
    sp.getAll(key).flatMap((v) => v.split(",").map((s) => s.trim()).filter(Boolean));

  const status = (sp.get("status") ?? "all") as StatusBucket;
  return {
    status: STATUS_OPTIONS.some((o) => o.value === status) ? status : "all",
    brands: arr("brand"),
    assignees: arr("assignee"),
    regions: arr("region").filter((r): r is Region =>
      REGION_OPTIONS.includes(r as Region),
    ),
    dateFrom: sp.get("from") || null,
    dateTo: sp.get("to") || null,
    issuesOnly: sp.get("issues") === "1",
  };
}

export function serializeFilters(f: OrdersFilterState): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.status !== "all") sp.set("status", f.status);
  if (f.brands.length) sp.set("brand", f.brands.join(","));
  if (f.assignees.length) sp.set("assignee", f.assignees.join(","));
  if (f.regions.length) sp.set("region", f.regions.join(","));
  if (f.dateFrom) sp.set("from", f.dateFrom);
  if (f.dateTo) sp.set("to", f.dateTo);
  if (f.issuesOnly) sp.set("issues", "1");
  return sp;
}

export function activeFilterCount(f: OrdersFilterState): number {
  let n = 0;
  if (f.status !== "all") n++;
  if (f.brands.length) n++;
  if (f.assignees.length) n++;
  if (f.regions.length) n++;
  if (f.dateFrom || f.dateTo) n++;
  if (f.issuesOnly) n++;
  return n;
}

// ── Popover ────────────────────────────────────────────────────────────────

type Props = {
  value: OrdersFilterState;
  onChange: (next: OrdersFilterState) => void;
  brands: { name: string }[];
  assignees: { id: string; full_name: string }[];
};

export function OrdersFilters({ value, onChange, brands, assignees }: Props) {
  const count = activeFilterCount(value);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] font-medium transition-colors",
            count > 0
              ? "border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]"
              : "border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)]",
          )}
          aria-label="Filters"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Filters
          {count > 0 ? (
            <span className="ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold tabular-nums text-white">
              {count}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "z-[100] flex w-[380px] max-h-[min(560px,calc(100vh-120px))] flex-col rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-md)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          )}
        >
          {/* Fixed header */}
          <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <h3 className="text-[13px] font-semibold text-[var(--ink)]">Filters</h3>
            {count > 0 ? (
              <span className="text-[11px] tabular-nums text-[var(--muted)]">{count} active</span>
            ) : null}
          </header>

          {/* Scrollable body — single scroll region */}
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
            {/* 1. Status (wrapping pills) */}
            <FilterRow title="Status">
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <Pill
                    key={opt.value}
                    active={value.status === opt.value}
                    onClick={() => onChange({ ...value, status: opt.value })}
                  >
                    {opt.label}
                  </Pill>
                ))}
              </div>
            </FilterRow>

            {/* 2. Issues */}
            <FilterRow title="Issues">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
                <span className="text-[12px] text-[var(--ink-2)]">
                  Show only delayed or unassigned
                </span>
                <input
                  type="checkbox"
                  checked={value.issuesOnly}
                  onChange={(e) => onChange({ ...value, issuesOnly: e.target.checked })}
                  className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
                />
              </label>
            </FilterRow>

            {/* 3. Assignee (compact picker; "Unassigned" pinned at top) */}
            <FilterRow
              title="Assignee"
              count={value.assignees.length}
            >
              <InlinePicker
                options={assignees.map((a) => ({ value: a.id, label: a.full_name }))}
                preferredFirst={[{ value: UNASSIGNED_SENTINEL, label: "Unassigned" }]}
                selected={value.assignees}
                onChange={(next) => onChange({ ...value, assignees: next })}
                placeholder="Search teammates…"
                addLabel="Add assignee"
              />
            </FilterRow>

            {/* 4. Brand (compact picker) */}
            {brands.length > 0 ? (
              <FilterRow title="Brand" count={value.brands.length}>
                <InlinePicker
                  options={brands.map((b) => ({ value: b.name, label: b.name }))}
                  selected={value.brands}
                  onChange={(next) => onChange({ ...value, brands: next })}
                  placeholder="Search brands…"
                  addLabel="Add brand"
                />
              </FilterRow>
            ) : null}

            {/* 5. Advanced — Region + Date range (auto-opens when populated) */}
            <details
              className="group rounded-md border border-[var(--line)] bg-[var(--hover)]/40"
              open={!!(value.dateFrom || value.dateTo || value.regions.length)}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] hover:text-[var(--ink-2)]">
                Advanced
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="space-y-4 border-t border-[var(--line)] p-3">
                {/* Region */}
                <FilterRow title="Region">
                  <div className="flex flex-wrap gap-1.5">
                    {REGION_OPTIONS.map((r) => {
                      const active = value.regions.includes(r);
                      return (
                        <Pill
                          key={r}
                          active={active}
                          onClick={() =>
                            onChange({
                              ...value,
                              regions: active
                                ? value.regions.filter((x) => x !== r)
                                : [...value.regions, r],
                            })
                          }
                        >
                          {r}
                        </Pill>
                      );
                    })}
                  </div>
                </FilterRow>

                {/* Date range */}
                <FilterRow title="Date range">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                      From
                      <input
                        type="date"
                        value={value.dateFrom ?? ""}
                        onChange={(e) => onChange({ ...value, dateFrom: e.target.value || null })}
                        className="h-9 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-[12px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                      To
                      <input
                        type="date"
                        value={value.dateTo ?? ""}
                        onChange={(e) => onChange({ ...value, dateTo: e.target.value || null })}
                        className="h-9 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-[12px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                      />
                    </label>
                  </div>
                </FilterRow>
              </div>
            </details>
          </div>

          {/* Sticky footer */}
          <footer className="flex items-center justify-between border-t border-[var(--line)] px-4 py-3">
            <button
              type="button"
              disabled={count === 0}
              onClick={() => onChange(EMPTY_FILTERS)}
              className="text-[12px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear all
            </button>
            <Popover.Close asChild>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md bg-[var(--ink)] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-black"
              >
                Done
              </button>
            </Popover.Close>
          </footer>

          <Popover.Arrow className="fill-[var(--panel)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ── Tiny presentational helpers ────────────────────────────────────────────

/** Section row inside the popover body. Optional "(N)" count appears in the title. */
function FilterRow({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
        <span>{title}</span>
        {count && count > 0 ? (
          <span className="tabular-nums normal-case text-[10.5px] text-[var(--muted)]">
            {count} selected
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-[11.5px] font-medium transition-colors",
        active
          ? "border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--line)] bg-[var(--panel)] text-[var(--ink-2)] hover:bg-[var(--hover)]",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Compact multi-select used by Brand + Assignee. Resting state shows the
 * selected values as removable pills plus a `+ Add` trigger; opening reveals
 * an inline search-and-check list. Stays open while toggling for rapid
 * multi-select; "outside click" inside the popover closes the picker but
 * leaves the popover open.
 */
type InlineOption = { value: string; label: string };

function InlinePicker({
  options,
  selected,
  onChange,
  placeholder,
  addLabel,
  preferredFirst,
}: {
  options: InlineOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
  preferredFirst?: InlineOption[];
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);

  // Close the inline picker on outside-click (but not when clicking inside it).
  // Doesn't close the outer popover — Radix handles that separately.
  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  // Lookup table for selected pill labels (covers preferredFirst values too).
  const labelByValue = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of options) m[o.value] = o.label;
    if (preferredFirst) for (const o of preferredFirst) m[o.value] = o.label;
    return m;
  }, [options, preferredFirst]);

  const filtered = React.useMemo(() => {
    const merged = preferredFirst
      ? [
          ...preferredFirst,
          ...options.filter((o) => !preferredFirst.some((p) => p.value === o.value)),
        ]
      : options;
    const needle = q.trim().toLowerCase();
    return needle ? merged.filter((o) => o.label.toLowerCase().includes(needle)) : merged;
  }, [options, q, preferredFirst]);

  function toggle(v: string) {
    onChange(selectedSet.has(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  }

  return (
    <div ref={rootRef} className="space-y-2">
      {/* Pills + Add trigger */}
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((v) => (
          <span
            key={v}
            className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] pl-2 pr-1 text-[11.5px] font-medium text-[var(--accent)]"
          >
            <span className="truncate max-w-[160px]">{labelByValue[v] ?? v}</span>
            <button
              type="button"
              onClick={() => toggle(v)}
              aria-label={`Remove ${labelByValue[v] ?? v}`}
              className="grid h-4 w-4 place-items-center rounded-full hover:bg-[var(--accent)]/15"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-full border border-dashed px-2 text-[11.5px] font-medium transition-colors",
            open
              ? "border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]"
              : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--ink)]",
          )}
        >
          <Plus className="h-3 w-3" aria-hidden />
          {addLabel}
        </button>
      </div>

      {/* Inline picker — only when open */}
      {open ? (
        <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-1.5 border-b border-[var(--line)] px-2">
            <Search className="h-3.5 w-3.5 text-[var(--muted-2)]" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              className="h-8 flex-1 bg-transparent text-[12px] text-[var(--ink)] placeholder:text-[var(--muted-2)] focus:outline-none"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="grid h-5 w-5 place-items-center rounded-md hover:bg-[var(--hover)]"
              >
                <X className="h-3 w-3 text-[var(--muted)]" aria-hidden />
              </button>
            ) : null}
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-1.5 text-[11.5px] text-[var(--muted)]">No match</div>
            ) : (
              filtered.map((opt) => {
                const checked = selectedSet.has(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
                      checked
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "text-[var(--ink-2)] hover:bg-[var(--hover)]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[4px] border",
                        checked
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-[var(--line)] bg-[var(--panel)]",
                      )}
                      aria-hidden
                    >
                      {checked ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Active-filter chip strip ───────────────────────────────────────────────

export function ActiveFiltersStrip({
  value,
  onChange,
  assigneeNameById,
}: {
  value: OrdersFilterState;
  onChange: (next: OrdersFilterState) => void;
  assigneeNameById: Record<string, string>;
}) {
  if (activeFilterCount(value) === 0) return null;

  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  if (value.status !== "all") {
    chips.push({
      key: `status-${value.status}`,
      label: `Status: ${value.status[0].toUpperCase() + value.status.slice(1)}`,
      onRemove: () => onChange({ ...value, status: "all" }),
    });
  }
  for (const b of value.brands) {
    chips.push({
      key: `brand-${b}`,
      label: `Brand: ${b}`,
      onRemove: () =>
        onChange({ ...value, brands: value.brands.filter((x) => x !== b) }),
    });
  }
  for (const a of value.assignees) {
    const display =
      a === UNASSIGNED_SENTINEL ? "Unassigned" : assigneeNameById[a] ?? "Assignee";
    chips.push({
      key: `assignee-${a}`,
      label: `Assignee: ${display}`,
      onRemove: () =>
        onChange({ ...value, assignees: value.assignees.filter((x) => x !== a) }),
    });
  }
  for (const r of value.regions) {
    chips.push({
      key: `region-${r}`,
      label: `Region: ${r}`,
      onRemove: () =>
        onChange({ ...value, regions: value.regions.filter((x) => x !== r) }),
    });
  }
  if (value.dateFrom || value.dateTo) {
    chips.push({
      key: "date",
      label: `Date: ${value.dateFrom ?? "…"} → ${value.dateTo ?? "…"}`,
      onRemove: () => onChange({ ...value, dateFrom: null, dateTo: null }),
    });
  }
  if (value.issuesOnly) {
    chips.push({
      key: "issues",
      label: "Issues only",
      onRemove: () => onChange({ ...value, issuesOnly: false }),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.onRemove}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-2.5 text-[11px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)]/80"
        >
          {c.label}
          <X className="h-3 w-3" aria-hidden />
        </button>
      ))}
    </div>
  );
}
