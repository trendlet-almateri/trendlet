"use client";

import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useMobileNav } from "./mobile-nav-context";

type MobileTopbarProps = {
  notifications?: React.ReactNode;
};

export function MobileTopbar({ notifications }: MobileTopbarProps) {
  const { toggle } = useMobileNav();

  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--line)] bg-[var(--bg)] px-3 md:hidden">
      <button
        type="button"
        onClick={toggle}
        className="grid h-9 w-9 place-items-center rounded-md text-[var(--muted)] hover:bg-black/5"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" aria-hidden />
      </button>

      <Logo size="sm" subtitle="Main store" />

      {notifications ?? <div className="h-9 w-9" aria-hidden />}
    </header>
  );
}
