"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { SlidersHorizontal, Check, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const chipBase =
  "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] px-3 text-[12px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]";
const chipActive = "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]";

const SORT_OPTIONS = [
  { value: "newest", label: "Sort: Newest first" },
  { value: "oldest", label: "Sort: Oldest first" },
];

export function FulfillmentFilterBar({
  brands,
  activeTab,
  brandFilter,
  sortKey,
}: {
  brands: { id: string; name: string }[];
  activeTab: string;
  brandFilter: string;
  sortKey: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", activeTab);
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const qs = params.toString();
    router.push(`/fulfillment${qs ? `?${qs}` : ""}`);
  }

  const selectedBrandLabel =
    brandFilter !== "all"
      ? (brands.find((b) => b.id === brandFilter)?.name ?? "+ Brand")
      : "+ Brand";

  const selectedSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortKey)?.label ?? "Sort: Newest first";

  return (
    <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 md:flex-wrap md:overflow-visible md:pb-0">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </span>

        {/* Priority — coming soon */}
        <span className={cn(chipBase, "cursor-not-allowed opacity-50")} title="Coming soon">
          + Priority
        </span>

        {/* Region — locked */}
        <span className={cn(chipBase, "cursor-not-allowed opacity-50")} title="Locked to EU for fulfillment">
          + Region
        </span>

        {/* Brand */}
        <FilterDropdown
          trigger={
            <span className={cn(chipBase, "cursor-pointer gap-2", brandFilter !== "all" && chipActive)}>
              {selectedBrandLabel}
              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
            </span>
          }
        >
          <DropdownItem
            label="+ Brand"
            active={brandFilter === "all"}
            onSelect={() => navigate("brand", "all")}
          />
          {brands.map((b) => (
            <DropdownItem
              key={b.id}
              label={b.name}
              active={brandFilter === b.id}
              onSelect={() => navigate("brand", b.id)}
            />
          ))}
        </FilterDropdown>
      </div>

      {/* Sort */}
      <div className="self-end md:self-auto">
        <FilterDropdown
          align="end"
          trigger={
            <span className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] pl-3 pr-2.5 text-[12px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--hover)]">
              {selectedSortLabel}
              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
            </span>
          }
        >
          {SORT_OPTIONS.map((o) => (
            <DropdownItem
              key={o.value}
              label={o.label}
              active={sortKey === o.value}
              onSelect={() => navigate("sort", o.value)}
            />
          ))}
        </FilterDropdown>
      </div>
    </div>
  );
}

function FilterDropdown({
  trigger,
  children,
  align = "start",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end" | "center";
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="focus:outline-none">
          {trigger}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          align={align}
          avoidCollisions
          collisionPadding={12}
          className={cn(
            "z-50 min-w-[180px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2",
            "shadow-[0_8px_24px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.04)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          )}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function DropdownItem({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] outline-none transition-colors",
        active
          ? "bg-[var(--accent)]/10 font-medium text-[var(--accent)]"
          : "text-[var(--ink)] hover:bg-[var(--hover)] focus:bg-[var(--hover)]",
      )}
    >
      <span className="flex-1">{label}</span>
      {active && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />}
    </DropdownMenu.Item>
  );
}
