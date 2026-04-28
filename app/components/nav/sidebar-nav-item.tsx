"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type SidebarNavItemProps = {
  href: string;
  label: string;
  count?: number | null;
  dot?: string;
};

/**
 * One row in the sidebar. Highlights when its route is the active path
 * (or a nested child of it).
 */
export function SidebarNavItem({ href, label, count, dot }: SidebarNavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "sidebar-item flex items-center justify-between",
        isActive && "sidebar-item-active",
      )}
    >
      <span className="flex items-center gap-2">
        {dot && (
          <span
            className={cn("h-1.5 w-1.5 rounded-full", dot)}
            aria-hidden
          />
        )}
        <span>{label}</span>
      </span>
      {typeof count === "number" && count > 0 && (
        <span className="text-[11px] tabular-nums text-neutral-400">
          {count.toLocaleString("en-US")}
        </span>
      )}
    </Link>
  );
}
