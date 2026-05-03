"use client";

import * as React from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { SidebarNavItem } from "./sidebar-nav-item";
import { UserDropdown } from "./user-dropdown";
import { visibleSections } from "./nav-items";
import { useMobileNav } from "./mobile-nav-context";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types/database";

const COUNT_KEY: Record<string, string> = {
  "/orders":         "orders",
  "/invoices":       "invoices",
  "/returns":        "returns",
  "/queue":          "sourcing",
  "/pipeline":       "warehouse",
  "/eu-fulfillment": "eu_fulfillment",
  "/ksa-last-mile":  "ksa_lastmile",
};

type Props = {
  user: { fullName: string; email: string; roles: Role[] };
  counts: Record<string, number | null>;
  unassignedCount: number;
  notifications?: React.ReactNode;
};

export function MobileSidebarDrawer({ user, counts, unassignedCount, notifications }: Props) {
  const { open, close } = useMobileNav();
  const pathname = usePathname();
  const sections = visibleSections(user.roles);
  const initials = getInitials(user.fullName);
  const primaryRole = user.roles[0] ?? "user";

  // Close when route changes
  React.useEffect(() => { close(); }, [pathname, close]);

  // Escape key
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[rgba(20,22,28,0.5)]"
        style={{ animation: "backdropIn 0.25s ease forwards" }}
        onClick={close}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-[#111418]"
        style={{ animation: "drawerIn 0.28s cubic-bezier(.32,.72,.32,1) forwards", transform: "translateX(-100%)" }}
        aria-label="Mobile navigation"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5">
          <Image src="/logo.png" alt="Trendlet" width={110} height={32} priority />
          <button
            type="button"
            onClick={close}
            className="grid h-8 w-8 place-items-center rounded-md text-[#6e7581] hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mx-3 h-px bg-white/[0.06]" />

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-2 pb-4 pt-5">
          {sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-1">
              <div className="px-3 pb-2 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6e7581]">
                {section.label}
              </div>
              {section.items.map((item) => {
                const key = COUNT_KEY[item.href];
                return (
                  <SidebarNavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    count={key ? counts[key] ?? null : null}
                    dot={item.dot ?? "bg-[#6e7581]"}
                    disabled={item.disabled}
                  />
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.06] px-2 py-2">
          <UserDropdown
            fullName={user.fullName}
            email={user.email}
            primaryRole={primaryRole}
            initials={initials}
            unassignedCount={unassignedCount}
          />
        </div>
      </aside>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
