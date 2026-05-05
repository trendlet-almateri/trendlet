"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Highlight trigger when a non-empty / non-"all" value is selected */
  showActive?: boolean;
  /** Extra classes applied to the trigger button (after base classes) */
  triggerClassName?: string;
  /** h-8 = default (filter bars), h-7 = sm (compact form rows) */
  size?: "default" | "sm";
  align?: DropdownMenu.DropdownMenuContentProps["align"];
};

export function DropdownSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  showActive,
  triggerClassName,
  size = "default",
  align = "start",
}: Props) {
  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;
  const isActive = showActive && !!value && value !== "all";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] border font-medium transition-colors hover:bg-[var(--hover)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            size === "sm" ? "h-7 pl-2.5 pr-2 text-[12px]" : "h-8 pl-3 pr-2.5 text-[12px]",
            isActive
              ? "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]"
              : "border-[var(--line)] bg-[var(--panel)] text-[var(--ink)]",
            triggerClassName,
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          align={align}
          avoidCollisions
          collisionPadding={12}
          className={cn(
            "z-[300] min-w-[180px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2",
            "shadow-[0_8px_24px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.04)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          )}
        >
          {options.map((o) => (
            <DropdownMenu.Item
              key={o.value}
              disabled={o.disabled}
              onSelect={() => onChange(o.value)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] outline-none transition-colors",
                o.value === value
                  ? "bg-[var(--accent)]/10 font-medium text-[var(--accent)]"
                  : "text-[var(--ink)] hover:bg-[var(--hover)] focus:bg-[var(--hover)]",
                o.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span className="flex-1">{o.label}</span>
              {o.value === value && (
                <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * Action-picker variant — never tracks a "current" value; always shows
 * the placeholder. Used for "Change status…" style selectors where
 * selecting fires a callback but the trigger resets to the placeholder.
 */
type ActionProps = {
  placeholder?: string;
  options: SelectOption[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  triggerClassName?: string;
  size?: "default" | "sm";
  align?: DropdownMenu.DropdownMenuContentProps["align"];
};

export function ActionDropdown({
  placeholder = "Select…",
  options,
  onSelect,
  disabled,
  triggerClassName,
  size = "default",
  align = "start",
}: ActionProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] border font-medium transition-colors hover:bg-[var(--hover)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            size === "sm" ? "h-7 pl-2.5 pr-2 text-[12px]" : "h-8 pl-3 pr-2.5 text-[12px]",
            "border-[var(--line)] bg-[var(--panel)] text-[var(--ink)]",
            triggerClassName,
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">{placeholder}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          align={align}
          avoidCollisions
          collisionPadding={12}
          className={cn(
            "z-[300] min-w-[180px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2",
            "shadow-[0_8px_24px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.04)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          )}
        >
          {options.map((o) => (
            <DropdownMenu.Item
              key={o.value}
              disabled={o.disabled}
              onSelect={() => onSelect(o.value)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] outline-none transition-colors",
                "text-[var(--ink)] hover:bg-[var(--hover)] focus:bg-[var(--hover)]",
                o.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span className="flex-1">{o.label}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
