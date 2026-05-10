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
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-all",
              dot,
              isActive && "shadow-[0_0_0_3px_rgba(122,136,255,0.25)]",
            )}
            aria-hidden
          />
        )}
        <span>{label}</span>
      </span>
      {typeof count === "number" && count > 0 && (
        <span
          className={cn(
            "tabular-nums text-[11px]",
            isActive ? "text-[#b8c1ff]/70" : "text-[#6e7581]",
          )}
        >
          {count.toLocaleString("en-US")}
        </span>
      )}
    </Link>
  );
}
