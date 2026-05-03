"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { visibleSections } from "./nav-items";
import { MobileUserMenu } from "./mobile-user-menu";
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
  const sections = visibleSections(roles);
  const allItems = sections.flatMap((s) => s.items).filter((item) => !item.disabled);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t border-[var(--line)] bg-[var(--panel)] shadow-[0_-1px_0_rgba(15,20,25,0.04)] md:hidden"
      aria-label="Primary navigation"
    >
      {/* Scrollable nav items */}
      <div className="flex flex-1 overflow-x-auto scrollbar-none">
        {allItems.map((item) => {
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
                active ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--ink)]",
              )}
            >
              <Icon
                className={cn("h-[18px] w-[18px] shrink-0", active && "drop-shadow-[0_0_6px_var(--accent)]")}
                aria-hidden
              />
              <span className={cn("w-full truncate text-center font-medium leading-none", active && "font-semibold")}>
                {item.label}
              </span>
              {active && (
                <span className="absolute bottom-0 h-0.5 w-6 rounded-full bg-[var(--accent)]" aria-hidden />
              )}
            </Link>
          );
        })}
      </div>

      {/* Profile — always pinned at right end */}
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
  );
}
