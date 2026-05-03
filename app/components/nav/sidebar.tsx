import Image from "next/image";
import { SidebarNavItem } from "./sidebar-nav-item";
import { UserDropdown } from "./user-dropdown";
import { MobileSidebarDrawer } from "./mobile-sidebar-drawer";
import { visibleSections } from "./nav-items";
import type { Role } from "@/lib/types/database";

type SidebarProps = {
  user: {
    fullName: string;
    email: string;
    roles: Role[];
  };
  counts: Record<string, number | null>;
  unassignedCount: number;
  notifications?: React.ReactNode;
};

const COUNT_KEY: Record<string, string> = {
  "/orders":         "orders",
  "/invoices":       "invoices",
  "/returns":        "returns",
  "/queue":          "sourcing",
  "/pipeline":       "warehouse",
  "/eu-fulfillment": "eu_fulfillment",
  "/ksa-last-mile":  "ksa_lastmile",
};

export function Sidebar({ user, counts, unassignedCount, notifications }: SidebarProps) {
  const sections = visibleSections(user.roles);
  const initials = getInitials(user.fullName);
  const primaryRole = user.roles[0] ?? "user";

  const navContent = (
    <>
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-3 pt-4">
        {sections.map((section) => (
          <div key={section.id} className="flex flex-col gap-0.5">
            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6e7581]">
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

      {/* Footer: user dropdown */}
      <div className="border-t border-white/[0.06] px-2 py-3">
        <UserDropdown
          fullName={user.fullName}
          email={user.email}
          primaryRole={primaryRole}
          initials={initials}
          unassignedCount={unassignedCount}
        />
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col bg-[#111418] text-neutral-300 md:flex"
        aria-label="Primary navigation"
      >
        {/* Header: logo + bell */}
        <div className="flex items-center justify-between px-4 py-3.5">
          <Image
            src="/logo.png"
            alt="Trendlet"
            width={110}
            height={32}
            priority
          />
          {notifications && (
            <div className="shrink-0">{notifications}</div>
          )}
        </div>

        <div className="mx-3 mb-1 h-px bg-white/[0.06]" />

        {navContent}
      </aside>

      {/* Mobile drawer (client component — handles open/close state) */}
      <MobileSidebarDrawer
        user={user}
        counts={counts}
        unassignedCount={unassignedCount}
        notifications={notifications}
      />
    </>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
