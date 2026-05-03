"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type SidebarNavItemProps = {
  href: string;
  label: string;
  count?: number | null;
  dot?: string;
  disabled?: boolean;
};

export function SidebarNavItem({ href, label, count, dot, disabled }: SidebarNavItemProps) {
  const pathname = usePathname();
  const isActive = !disabled && (pathname === href || pathname.startsWith(href + "/"));

  const inner = (
    <>
      <span className="flex items-center gap-2">
        {dot && (
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-all",
              disabled ? "bg-[#6e7581]/40" : dot,
              isActive && "shadow-[0_0_0_3px_rgba(122,136,255,0.25)]",
            )}
            aria-hidden
          />
        )}
        <span>{label}</span>
      </span>
      {typeof count === "number" && count > 0 && !disabled && (
        <span
          className={cn(
            "tabular-nums text-[11px]",
            isActive ? "text-[#b8c1ff]/70" : "text-[#6e7581]",
          )}
        >
          {count.toLocaleString("en-US")}
        </span>
      )}
    </>
  );

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="sidebar-item flex cursor-not-allowed items-center justify-between opacity-35 select-none"
      >
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "sidebar-item flex items-center justify-between",
        isActive && "sidebar-item-active",
      )}
    >
      {inner}
    </Link>
  );
}
