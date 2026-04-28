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
      className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t border-hairline bg-surface md:hidden"
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
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px]",
              active ? "text-navy" : "text-ink-tertiary",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
