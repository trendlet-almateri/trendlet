"use client";

/**
 * Orders filters — one popover containing six independent filters.
 * Live-applied, combinable, persisted to URL by the caller via parseFilters /
 * serializeFilters. The orders-view owns the state; this file just renders the
 * popover and emits onChange diffs.
 */

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal, X, Check } from "lucide-react";
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
            "z-[100] w-[360px] max-h-[min(640px,calc(100vh-120px))] overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-md)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          )}
        >
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-[var(--ink)]">Filters</h3>
            {count > 0 ? (
              <button
                type="button"
                onClick={() => onChange(EMPTY_FILTERS)}
                className="text-[11px] font-medium text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Clear all
              </button>
            ) : null}
          </div>

          {/* Status */}
          <Section title="Status">
            <div className="grid grid-cols-3 gap-1.5">
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
          </Section>

          {/* Brand */}
          {brands.length > 0 ? (
            <Section title="Brand">
              <CheckboxList
                options={brands.map((b) => ({ value: b.name, label: b.name }))}
                selected={value.brands}
                onChange={(next) => onChange({ ...value, brands: next })}
                emptyLabel="No brands"
              />
            </Section>
          ) : null}

          {/* Assignee */}
          <Section title="Assignee">
            <CheckboxList
              options={[
                { value: UNASSIGNED_SENTINEL, label: "Unassigned" },
                ...assignees.map((a) => ({ value: a.id, label: a.full_name })),
              ]}
              selected={value.assignees}
              onChange={(next) => onChange({ ...value, assignees: next })}
              emptyLabel="No teammates"
            />
          </Section>

          {/* Region */}
          <Section title="Region">
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
          </Section>

          {/* Date range */}
          <Section title="Date range">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={value.dateFrom ?? ""}
                onChange={(e) => onChange({ ...value, dateFrom: e.target.value || null })}
                className="h-8 flex-1 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-[12px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                aria-label="From"
              />
              <span className="text-[11px] text-[var(--muted)]">–</span>
              <input
                type="date"
                value={value.dateTo ?? ""}
                onChange={(e) => onChange({ ...value, dateTo: e.target.value || null })}
                className="h-8 flex-1 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-[12px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                aria-label="To"
              />
            </div>
          </Section>

          {/* Issues only */}
          <Section title="Issues">
            <label className="flex cursor-pointer items-center justify-between gap-3">
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
          </Section>

          <Popover.Arrow className="fill-[var(--panel)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ── Tiny presentational helpers ────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
        {title}
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

function CheckboxList({
  options,
  selected,
  onChange,
  emptyLabel,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel: string;
}) {
  const [q, setQ] = React.useState("");
  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [options, q]);

  if (options.length === 0) {
    return <div className="text-[12px] text-[var(--muted)]">{emptyLabel}</div>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {options.length > 6 ? (
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="h-7 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-[12px] text-[var(--ink)] placeholder:text-[var(--muted-2)] focus:border-[var(--accent)] focus:outline-none"
        />
      ) : null}
      <div className="max-h-[180px] overflow-y-auto pr-1">
        <div className="flex flex-col gap-0.5">
          {filtered.map((opt) => {
            const active = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  onChange(
                    active
                      ? selected.filter((v) => v !== opt.value)
                      : [...selected, opt.value],
                  )
                }
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12px] transition-colors",
                  active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "hover:bg-[var(--hover)] text-[var(--ink-2)]",
                )}
              >
                <span
                  className={cn(
                    "flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[4px] border",
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--line)] bg-[var(--panel)]",
                  )}
                  aria-hidden
                >
                  {active ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
          {filtered.length === 0 ? (
            <div className="px-1.5 py-1 text-[11.5px] text-[var(--muted)]">No match</div>
          ) : null}
        </div>
      </div>
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
