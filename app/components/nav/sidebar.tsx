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

      {/* Nav sections */}
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 pb-3 pt-3">
        {sections.map((section) => (
          <div key={section.id} className="flex flex-col gap-0.5">
            <div className="px-3 pb-1 pt-1 text-[10px] font-medium uppercase tracking-[0.5px] text-neutral-500">
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
                  dot={item.dot ?? "bg-neutral-500"}
                />
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom: user dropdown */}
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
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
