"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, Search, MoreHorizontal, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/search", label: "Search", icon: Search },
  { href: "/more", label: "More", icon: MoreHorizontal },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t border-[var(--line)] bg-[var(--panel)] shadow-[0_-1px_0_rgba(15,20,25,0.04)] md:hidden"
      aria-label="Primary navigation"
    >
      {ITEMS.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(item.href + "/"));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors",
              active ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--ink)]",
            )}
          >
            <Icon className={cn("h-4 w-4", active && "drop-shadow-[0_0_6px_var(--accent)]")} aria-hidden />
            <span className={cn("font-medium", active && "font-semibold")}>{item.label}</span>
            {active && (
              <span className="absolute bottom-0 h-0.5 w-6 rounded-full bg-[var(--accent)]" aria-hidden />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
