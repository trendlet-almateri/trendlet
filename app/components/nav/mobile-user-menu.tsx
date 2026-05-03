"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  User,
  CircleUser,
  Settings2,
  AlertTriangle,
  Store,
  Tag,
  Users,
  Truck,
  Plug,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { TeamRolesModal } from "@/components/modals/team-roles-modal";
import { BrandsModal } from "@/components/modals/brands-modal";
import { ProfileModal } from "@/components/modals/profile-modal";
import { PreferencesModal } from "@/components/modals/preferences-modal";
import { StoresModal } from "@/components/modals/stores-modal";
import { CarriersModal } from "@/components/modals/carriers-modal";
import { IntegrationsModal } from "@/components/modals/integrations-modal";
import { SecurityModal } from "@/components/modals/security-modal";
import { UnassignedModal } from "@/components/modals/unassigned-modal";

type Props = {
  fullName: string;
  email: string;
  primaryRole: string;
  initials: string;
  unassignedCount: number;
};

type ModalKey = "team" | "brands" | "profile" | "preferences" | "stores" | "carriers" | "integrations" | "security" | "unassigned";

export function MobileUserMenu({ fullName, email, primaryRole, initials, unassignedCount }: Props) {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);
  const [activeModal, setActiveModal] = React.useState<null | ModalKey>(null);

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
      {activeModal === "team" && <TeamRolesModal onClose={() => setActiveModal(null)} />}
      {activeModal === "brands" && <BrandsModal onClose={() => setActiveModal(null)} />}
      {activeModal === "profile" && <ProfileModal fullName={fullName} email={email} primaryRole={primaryRole} initials={initials} onClose={() => setActiveModal(null)} />}
      {activeModal === "preferences" && <PreferencesModal onClose={() => setActiveModal(null)} />}
      {activeModal === "stores" && <StoresModal onClose={() => setActiveModal(null)} />}
      {activeModal === "carriers" && <CarriersModal onClose={() => setActiveModal(null)} />}
      {activeModal === "integrations" && <IntegrationsModal onClose={() => setActiveModal(null)} />}
      {activeModal === "security" && <SecurityModal email={email} onClose={() => setActiveModal(null)} />}
      {activeModal === "unassigned" && <UnassignedModal onClose={() => setActiveModal(null)} />}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className="relative flex min-w-[56px] shrink-0 flex-col items-center justify-center gap-0.5 px-2 text-[10px] text-[var(--muted)] transition-colors hover:text-[var(--ink)] focus:outline-none data-[state=open]:text-[var(--accent)]"
          aria-label="Open account menu"
        >
          <User className="h-[18px] w-[18px]" aria-hidden />
          <span className="font-medium leading-none">Profile</span>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="top"
            align="end"
            sideOffset={8}
            className={cn(
              "z-50 w-[280px] rounded-xl border border-[var(--line)] bg-white p-1.5",
              "shadow-[0_-8px_32px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)]",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
              "data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-bottom-2",
            )}
          >
            {/* Profile header */}
            <div className="flex items-center gap-3 px-3 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[14px] font-semibold text-white">
                {initials}
              </span>
              <div className="flex min-w-0 flex-col leading-snug">
                <span className="truncate text-[13px] font-semibold text-[var(--ink)]">{fullName}</span>
                <span className="truncate text-[11px] text-[var(--muted)]">
                  {email} · <span className="capitalize">{primaryRole}</span>
                </span>
              </div>
            </div>

            <DropdownMenu.Separator className="my-1 h-px bg-[var(--line)]" />

            <SectionLabel>Account</SectionLabel>
            <ItemButton icon={CircleUser} right={<OnlinePill />} onSelect={() => setActiveModal("profile")}>
              Profile &amp; presence
            </ItemButton>
            <ItemButton icon={Settings2} right="EN · SAR" onSelect={() => setActiveModal("preferences")}>
              My preferences
            </ItemButton>

            <DropdownMenu.Separator className="my-1 h-px bg-[var(--line)]" />

            <SectionLabel>Queue</SectionLabel>
            <ItemButton
              icon={AlertTriangle}
              right={
                unassignedCount > 0 ? (
                  <span className="rounded-full bg-red-600 px-1.5 py-px text-[10px] font-medium text-white tabular-nums">
                    {unassignedCount}
                  </span>
                ) : null
              }
              tone={unassignedCount > 0 ? "danger" : undefined}
              onSelect={() => setActiveModal("unassigned")}
            >
              Unassigned sub-orders
            </ItemButton>

            <DropdownMenu.Separator className="my-1 h-px bg-[var(--line)]" />

            <SectionLabel>Workspace setup</SectionLabel>
            <ItemButton icon={Store} right="0 active" onSelect={() => setActiveModal("stores")}>Stores</ItemButton>
            <ItemButton icon={Tag} right="Brands" onSelect={() => setActiveModal("brands")}>Brands &amp; assignments</ItemButton>
            <ItemButton icon={Users} right="Team" onSelect={() => setActiveModal("team")}>Team &amp; roles</ItemButton>
            <ItemButton icon={Truck} right="3 active" onSelect={() => setActiveModal("carriers")}>Carriers</ItemButton>
            <ItemButton icon={Plug} right="4 active" onSelect={() => setActiveModal("integrations")}>Integrations</ItemButton>
            <ItemButton icon={ShieldCheck} right="2FA off" onSelect={() => setActiveModal("security")}>Security</ItemButton>

            <DropdownMenu.Separator className="my-1 h-px bg-[var(--line)]" />

            <DropdownMenu.Item
              onSelect={(e) => { e.preventDefault(); void signOut(); }}
              disabled={signingOut}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-red-600 outline-none hover:bg-red-50 focus:bg-red-50 data-[disabled]:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              <span>{signingOut ? "Signing out…" : "Sign out"}</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.5px] text-[var(--muted)]">
      {children}
    </div>
  );
}

type ItemButtonProps = {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  right?: React.ReactNode;
  onSelect: () => void;
  tone?: "danger";
};

function ItemButton({ icon: Icon, children, right, onSelect, tone }: ItemButtonProps) {
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
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
      Online
    </span>
  );
}
