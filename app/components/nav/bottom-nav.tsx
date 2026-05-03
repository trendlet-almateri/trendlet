"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { visibleSections } from "./nav-items";
import { MobileUserMenu } from "./mobile-user-menu";
import { MobileMoreSheet } from "./mobile-more-sheet";
import type { Role } from "@/lib/types/database";

type Props = {
  roles: Role[];
  fullName: string;
  email: string;
  primaryRole: string;
  initials: string;
  unassignedCount: number;
};

export function BottomNav({ roles, fullName, email, primaryRole, initials, unassignedCount }: Props) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const sections = visibleSections(roles);

  const workspaceSection = sections.find((s) => s.id === "workspace");
  const operationsSection = sections.find((s) => s.id === "operations");
  const insightsSection = sections.find((s) => s.id === "insights");

  // Zone 1 direct tabs: workspace items if present; otherwise the user's operations item(s)
  const directItems = (workspaceSection?.items.length ?? 0) > 0
    ? workspaceSection!.items
    : (operationsSection?.items.filter((i) => !i.disabled) ?? []);

  // Zone 2 More sheet: always Operations + Insights
  const moreSheetSections = [
    ...(operationsSection ? [operationsSection] : []),
    ...(insightsSection ? [insightsSection] : []),
  ];

  // Close More sheet on route change
  React.useEffect(() => { setMoreOpen(false); }, [pathname]);

  return (
    <>
      <MobileMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        sections={moreSheetSections}
      />

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t border-[var(--line)] bg-[var(--panel)] shadow-[0_-1px_0_rgba(15,20,25,0.04)] md:hidden"
        aria-label="Primary navigation"
      >
        {/* ── Zone 1: Direct tabs (scrollable) ── */}
        <div className="scrollbar-none flex flex-1 overflow-x-auto">
          {directItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href + "/"));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[9.5px] transition-colors",
                  active
                    ? "text-[var(--accent)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)]",
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    active && "drop-shadow-[0_0_6px_var(--accent)]",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "w-full truncate text-center font-medium leading-none",
                    active && "font-semibold",
                  )}
                >
                  {item.label}
                </span>
                {active && (
                  <span
                    className="absolute bottom-0 h-0.5 w-6 rounded-full bg-[var(--accent)]"
                    aria-hidden
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* ── Zone 2: More ── */}
        <div className="flex shrink-0 items-stretch border-l border-[var(--line)]">
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-label="More"
            aria-expanded={moreOpen}
            className={cn(
              "relative flex min-w-[56px] flex-col items-center justify-center gap-0.5 px-2 text-[9.5px] transition-colors focus:outline-none",
              moreOpen
                ? "text-[var(--accent)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]",
            )}
          >
            <MoreHorizontal className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="font-medium leading-none">More</span>
          </button>
        </div>

        {/* ── Zone 3: Profile ── */}
        <div className="flex shrink-0 items-stretch border-l border-[var(--line)]">
          <MobileUserMenu
            fullName={fullName}
            email={email}
            primaryRole={primaryRole}
            initials={initials}
            unassignedCount={unassignedCount}
          />
        </div>
      </nav>
    </>
  );
}
