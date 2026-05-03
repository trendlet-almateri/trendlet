"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  MoreHorizontal, X, ChevronRight,
  CircleUser, Settings2, AlertTriangle,
  Store, Tag, Users, Truck, Plug, ShieldCheck, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { visibleSections } from "./nav-items";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types/database";
import { TeamRolesModal } from "@/components/modals/team-roles-modal";
import { BrandsModal } from "@/components/modals/brands-modal";
import { ProfileModal } from "@/components/modals/profile-modal";
import { PreferencesModal } from "@/components/modals/preferences-modal";
import { StoresModal } from "@/components/modals/stores-modal";
import { CarriersModal } from "@/components/modals/carriers-modal";
import { IntegrationsModal } from "@/components/modals/integrations-modal";
import { SecurityModal } from "@/components/modals/security-modal";
import { UnassignedModal } from "@/components/modals/unassigned-modal";

type User = {
  fullName: string;
  email: string;
  roles: Role[];
  initials: string;
  primaryRole: string;
  unassignedCount: number;
};

type ModalKey = "team" | "brands" | "profile" | "preferences" | "stores" | "carriers" | "integrations" | "security" | "unassigned";

export function BottomNav({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const [activeModal, setActiveModal] = React.useState<ModalKey | null>(null);

  // Close More sheet on navigation
  React.useEffect(() => { setMoreOpen(false); }, [pathname]);

  const sections = visibleSections(user.roles);
  const workspace  = sections.find((s) => s.id === "workspace")?.items  ?? [];
  const operations = sections.find((s) => s.id === "operations")?.items ?? [];
  const insights   = sections.find((s) => s.id === "insights")?.items   ?? [];

  // Direct tabs = workspace items; if none, fall back to operations items
  const directTabs     = workspace.length > 0 ? workspace : operations;
  const moreOperations = workspace.length > 0 ? operations : [];
  const moreInsights   = insights;
  const hasMore        = moreOperations.length > 0 || moreInsights.length > 0;

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {/* ── Modals ── */}
      {activeModal === "team"         && <TeamRolesModal onClose={() => setActiveModal(null)} />}
      {activeModal === "brands"       && <BrandsModal onClose={() => setActiveModal(null)} />}
      {activeModal === "profile"      && <ProfileModal fullName={user.fullName} email={user.email} primaryRole={user.primaryRole} initials={user.initials} onClose={() => setActiveModal(null)} />}
      {activeModal === "preferences"  && <PreferencesModal onClose={() => setActiveModal(null)} />}
      {activeModal === "stores"       && <StoresModal onClose={() => setActiveModal(null)} />}
      {activeModal === "carriers"     && <CarriersModal onClose={() => setActiveModal(null)} />}
      {activeModal === "integrations" && <IntegrationsModal onClose={() => setActiveModal(null)} />}
      {activeModal === "security"     && <SecurityModal email={user.email} onClose={() => setActiveModal(null)} />}
      {activeModal === "unassigned"   && <UnassignedModal onClose={() => setActiveModal(null)} />}

      {/* ── More sheet ── */}
      {moreOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute inset-x-3 bottom-[72px] rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-md)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <span className="text-[13px] font-semibold text-[var(--ink)]">More</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--hover)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-2">
              {moreOperations.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    Operations
                  </p>
                  {moreOperations.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    if (item.disabled) {
                      return (
                        <span key={item.href} className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 opacity-35 select-none">
                          <Icon className="h-4 w-4 text-[var(--muted)]" aria-hidden />
                          <span className="text-[13px] text-[var(--muted)]">{item.label}</span>
                        </span>
                      );
                    }
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                          active
                            ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "text-[var(--ink)] hover:bg-[var(--hover)]",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="flex-1 text-[13px] font-medium">{item.label}</span>
                        {active && <ChevronRight className="h-3.5 w-3.5 opacity-40" />}
                      </Link>
                    );
                  })}
                </>
              )}

              {moreInsights.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    Insights
                  </p>
                  {moreInsights.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                          active
                            ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "text-[var(--ink)] hover:bg-[var(--hover)]",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="flex-1 text-[13px] font-medium">{item.label}</span>
                        {active && <ChevronRight className="h-3.5 w-3.5 opacity-40" />}
                      </Link>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom bar ── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 shrink-0 items-stretch border-t border-[var(--line)] bg-[var(--panel)]">
        {/* Direct workspace/operations tabs */}
        {directTabs.map((item) => {
          const Icon = item.icon;
          const active = !item.disabled && (pathname === item.href || pathname.startsWith(item.href + "/"));

          if (item.disabled) {
            return (
              <span
                key={item.href}
                className="flex flex-1 cursor-not-allowed flex-col items-center justify-center gap-0.5 opacity-35 select-none"
              >
                <Icon className="h-5 w-5 text-[var(--muted)]" aria-hidden />
                <span className="text-[9px] font-medium text-[var(--muted)]">{item.label}</span>
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
                active ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--ink)]",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="text-[9px] font-medium">{item.label}</span>
              {active && (
                <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-[var(--accent)]" aria-hidden />
              )}
            </Link>
          );
        })}

        {/* More tab */}
        {hasMore && (
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
              moreOpen ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--ink)]",
            )}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
            <span className="text-[9px] font-medium">More</span>
            {moreOpen && (
              <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-[var(--accent)]" aria-hidden />
            )}
          </button>
        )}

        {/* Profile tab — dropdown opens upward */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[var(--muted)] transition-colors hover:text-[var(--ink)] focus:outline-none data-[state=open]:text-[var(--accent)]"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)]/10 text-[10px] font-semibold text-[var(--accent)]">
                {user.initials}
              </span>
              <span className="text-[9px] font-medium">Profile</span>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="top"
              align="end"
              sideOffset={12}
              className={cn(
                "z-50 w-[280px] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5",
                "shadow-[var(--shadow-md)]",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
                "data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-bottom-2",
              )}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-3 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[14px] font-semibold text-white">
                  {user.initials}
                </span>
                <div className="flex min-w-0 flex-col leading-snug">
                  <span className="truncate text-[13px] font-semibold text-[var(--ink)]">{user.fullName}</span>
                  <span className="truncate text-[11px] text-[var(--muted)]">
                    {user.email} · <span className="capitalize">{user.primaryRole}</span>
                  </span>
                </div>
              </div>

              <DropdownMenu.Separator className="my-1 h-px bg-[var(--line)]" />

              <MenuLabel>Account</MenuLabel>
              <MenuButton icon={CircleUser} right={<OnlinePill />} onSelect={() => setActiveModal("profile")}>
                Profile &amp; presence
              </MenuButton>
              <MenuButton icon={Settings2} right="EN · SAR" onSelect={() => setActiveModal("preferences")}>
                My preferences
              </MenuButton>

              <DropdownMenu.Separator className="my-1 h-px bg-[var(--line)]" />

              <MenuLabel>Queue</MenuLabel>
              <MenuButton
                icon={AlertTriangle}
                tone={user.unassignedCount > 0 ? "danger" : undefined}
                right={
                  user.unassignedCount > 0 ? (
                    <span className="rounded-full bg-red-600 px-1.5 py-px text-[10px] font-medium text-white tabular-nums">
                      {user.unassignedCount}
                    </span>
                  ) : null
                }
                onSelect={() => setActiveModal("unassigned")}
              >
                Unassigned sub-orders
              </MenuButton>

              <DropdownMenu.Separator className="my-1 h-px bg-[var(--line)]" />

              <MenuLabel>Workspace setup</MenuLabel>
              <MenuButton icon={Store}      right="0 active"  onSelect={() => setActiveModal("stores")}>Stores</MenuButton>
              <MenuButton icon={Tag}        right="Brands"    onSelect={() => setActiveModal("brands")}>Brands &amp; assignments</MenuButton>
              <MenuButton icon={Users}      right="Team"      onSelect={() => setActiveModal("team")}>Team &amp; roles</MenuButton>
              <MenuButton icon={Truck}      right="3 active"  onSelect={() => setActiveModal("carriers")}>Carriers</MenuButton>
              <MenuButton icon={Plug}       right="4 active"  onSelect={() => setActiveModal("integrations")}>Integrations</MenuButton>
              <MenuButton icon={ShieldCheck} right="2FA off"  onSelect={() => setActiveModal("security")}>Security</MenuButton>

              <DropdownMenu.Separator className="my-1 h-px bg-[var(--line)]" />

              <DropdownMenu.Item
                onSelect={(e) => { e.preventDefault(); void signOut(); }}
                disabled={signingOut}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-red-600 outline-none transition-colors hover:bg-red-50 focus:bg-red-50 data-[disabled]:opacity-50"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                <span>{signingOut ? "Signing out…" : "Sign out"}</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </nav>
    </>
  );
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">
      {children}
    </div>
  );
}

function MenuButton({
  icon: Icon, children, right, onSelect, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  right?: React.ReactNode;
  onSelect: () => void;
  tone?: "danger";
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors",
        tone === "danger"
          ? "bg-red-50 text-red-600 hover:bg-red-100 focus:bg-red-100"
          : "text-[var(--ink)] hover:bg-[var(--hover)] focus:bg-[var(--hover)]",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", tone === "danger" ? "text-red-500" : "text-[var(--muted)]")} aria-hidden />
      <span className="flex-1 truncate">{children}</span>
      {right && <span className="shrink-0 text-[11px] text-[var(--muted)]">{right}</span>}
    </DropdownMenu.Item>
  );
}

function OnlinePill() {
  return (
    <span className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#5DCAA5]" aria-hidden />
      Online
    </span>
  );
}
