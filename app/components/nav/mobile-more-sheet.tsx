"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavSection } from "./nav-items";

type Props = {
  open: boolean;
  onClose: () => void;
  sections: NavSection[];
};

export function MobileMoreSheet({ open, onClose, sections }: Props) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop — z-30, nav stays above at z-40 */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet — slides up from bottom, pb-14 keeps content above the bottom nav */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More navigation"
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 flex max-h-[72vh] flex-col rounded-t-2xl bg-[var(--panel)] pb-14 shadow-[0_-8px_40px_rgba(0,0,0,0.14)] transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        {/* Drag handle pill */}
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1 w-9 rounded-full bg-[var(--line)]" aria-hidden />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <span className="text-[14px] font-semibold text-[var(--ink)]">More</span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-full bg-[var(--hover)] text-[var(--muted)] hover:text-[var(--ink)]"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        {/* Sections */}
        <div className="scrollbar-none flex-1 overflow-y-auto">
          {sections.map((section, i) => (
            <div key={section.id}>
              {i > 0 && <div className="mx-4 my-1 h-px bg-[var(--line)]" />}

              <div className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                {section.label}
              </div>

              {section.items.map((item) => {
                const Icon = item.icon;
                if (item.disabled) {
                  return (
                    <span
                      key={item.href}
                      className="flex cursor-not-allowed select-none items-center gap-3 px-4 py-2.5 opacity-35"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--hover)]">
                        <Icon className="h-[18px] w-[18px] text-[var(--muted)]" aria-hidden />
                      </span>
                      <span className="text-[13px] font-medium text-[var(--ink)]">{item.label}</span>
                    </span>
                  );
                }

                const active =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href + "/"));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 transition-colors",
                      active
                        ? "bg-[var(--accent)]/[0.07]"
                        : "hover:bg-[var(--hover)]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                        active ? "bg-[var(--accent)]/[0.12]" : "bg-[var(--hover)]",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px]",
                          active ? "text-[var(--accent)]" : "text-[var(--muted)]",
                        )}
                        aria-hidden
                      />
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-[13px] font-medium",
                        active ? "text-[var(--accent)]" : "text-[var(--ink)]",
                      )}
                    >
                      {item.label}
                    </span>
                    {active && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
