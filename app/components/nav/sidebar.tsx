import Image from "next/image";
import { SidebarNavItem } from "./sidebar-nav-item";
import { UserDropdown } from "./user-dropdown";
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
  "/orders": "orders",
  "/invoices": "invoices",
  "/returns": "returns",
  "/queue": "sourcing",
  "/pipeline": "warehouse",
  "/eu-fulfillment": "eu_fulfillment",
  "/deliveries": "ksa_lastmile",
};

export function Sidebar({ user, counts, unassignedCount, notifications }: SidebarProps) {
  const sections = visibleSections(user.roles);
  const initials = getInitials(user.fullName);
  const primaryRole = user.roles[0] ?? "user";

  return (
    <aside
      className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col bg-sidebar text-neutral-300 md:flex"
      aria-label="Primary navigation"
    >
      {/* Logo */}
      <div className="flex items-center justify-center px-4 pb-3 pt-5">
        <Image
          src="/logo.png"
          alt="Trendlet"
          width={130}
          height={38}
          priority
        />
      </div>

      {/* Sections */}
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 pb-3 pt-1">
        {sections.map((section) => (
          <div key={section.id} className="flex flex-col gap-0.5">
            <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.4px] text-neutral-500">
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
                  dot={item.dot}
                />
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom: notifications + user dropdown */}
      <div className="border-t border-white/[0.06] px-2 py-2 flex flex-col gap-1">
        {notifications && (
          <div className="px-1">{notifications}</div>
        )}
        <UserDropdown
          fullName={user.fullName}
          email={user.email}
          primaryRole={primaryRole}
          initials={initials}
          unassignedCount={unassignedCount}
        />
      </div>
    </aside>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
