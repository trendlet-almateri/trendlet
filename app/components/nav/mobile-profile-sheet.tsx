"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  X, CircleUser, Settings2, AlertTriangle,
  Store, Tag, Users, Truck, Plug, ShieldCheck, LogOut,
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

type ModalKey =
  | "team" | "brands" | "profile" | "preferences"
  | "stores" | "carriers" | "integrations" | "security" | "unassigned";

type Props = {
  open: boolean;
  onClose: () => void;
  fullName: string;
  email: string;
  primaryRole: string;
  initials: string;
  unassignedCount: number;
};

export function MobileProfileSheet({
  open, onClose, fullName, email, primaryRole, initials, unassignedCount,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = React.useState(false);
  const [activeModal, setActiveModal] = React.useState<null | ModalKey>(null);

  // Close sheet on route change
  React.useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function openModal(key: ModalKey) {
    onClose();
    // slight delay so the sheet closes before modal opens
    setTimeout(() => setActiveModal(key), 150);
  }

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
      {/* Modals */}
      {activeModal === "team"         && <TeamRolesModal onClose={() => setActiveModal(null)} />}
      {activeModal === "brands"       && <BrandsModal onClose={() => setActiveModal(null)} />}
      {activeModal === "profile"      && <ProfileModal fullName={fullName} email={email} primaryRole={primaryRole} initials={initials} onClose={() => setActiveModal(null)} />}
      {activeModal === "preferences"  && <PreferencesModal onClose={() => setActiveModal(null)} />}
      {activeModal === "stores"       && <StoresModal onClose={() => setActiveModal(null)} />}
      {activeModal === "carriers"     && <CarriersModal onClose={() => setActiveModal(null)} />}
      {activeModal === "integrations" && <IntegrationsModal onClose={() => setActiveModal(null)} />}
      {activeModal === "security"     && <SecurityModal email={email} onClose={() => setActiveModal(null)} />}
      {activeModal === "unassigned"   && <UnassignedModal onClose={() => setActiveModal(null)} />}

      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Account menu"
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 flex max-h-[80vh] flex-col rounded-t-2xl bg-[var(--panel)] pb-14 shadow-[0_-8px_40px_rgba(0,0,0,0.14)] transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1 w-9 rounded-full bg-[var(--line)]" aria-hidden />
        </div>

        {/* Profile header */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[14px] font-semibold text-white">
              {initials}
            </span>
            <div className="flex flex-col leading-snug">
              <span className="text-[13px] font-semibold text-[var(--ink)]">{fullName}</span>
              <span className="text-[11px] text-[var(--muted)] capitalize">{primaryRole}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-full bg-[var(--hover)] text-[var(--muted)] hover:text-[var(--ink)]"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <div className="mx-4 h-px bg-[var(--line)]" />

        {/* Menu items */}
        <div className="scrollbar-none flex-1 overflow-y-auto py-2">
          <SectionLabel>Account</SectionLabel>
          <SheetItem icon={CircleUser} right={<OnlinePill />} onPress={() => openModal("profile")}>
            Profile &amp; presence
          </SheetItem>
          <SheetItem icon={Settings2} right="EN · SAR" onPress={() => openModal("preferences")}>
            My preferences
          </SheetItem>

          <div className="mx-4 my-2 h-px bg-[var(--line)]" />

          <SectionLabel>Queue</SectionLabel>
          <SheetItem
            icon={AlertTriangle}
            tone={unassignedCount > 0 ? "danger" : undefined}
            right={
              unassignedCount > 0 ? (
                <span className="rounded-full bg-red-600 px-1.5 py-px text-[10px] font-medium text-white tabular-nums">
                  {unassignedCount}
                </span>
              ) : null
            }
            onPress={() => openModal("unassigned")}
          >
            Unassigned sub-orders
          </SheetItem>

          <div className="mx-4 my-2 h-px bg-[var(--line)]" />

          <SectionLabel>Workspace setup</SectionLabel>
          <SheetItem icon={Store}     right="0 active"  onPress={() => openModal("stores")}>Stores</SheetItem>
          <SheetItem icon={Tag}       right="Brands"     onPress={() => openModal("brands")}>Brands &amp; assignments</SheetItem>
          <SheetItem icon={Users}     right="Team"       onPress={() => openModal("team")}>Team &amp; roles</SheetItem>
          <SheetItem icon={Truck}     right="3 active"  onPress={() => openModal("carriers")}>Carriers</SheetItem>
          <SheetItem icon={Plug}      right="4 active"  onPress={() => openModal("integrations")}>Integrations</SheetItem>
          <SheetItem icon={ShieldCheck} right="2FA off" onPress={() => openModal("security")}>Security</SheetItem>

          <div className="mx-4 my-2 h-px bg-[var(--line)]" />

          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-50">
              <LogOut className="h-[18px] w-[18px] text-red-500" aria-hidden />
            </span>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
      {children}
    </div>
  );
}

type SheetItemProps = {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  right?: React.ReactNode;
  onPress: () => void;
  tone?: "danger";
};

function SheetItem({ icon: Icon, children, right, onPress, tone }: SheetItemProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2.5 text-[13px] transition-colors",
        tone === "danger"
          ? "bg-red-50/60 text-red-600 hover:bg-red-50"
          : "text-[var(--ink)] hover:bg-[var(--hover)]",
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
          tone === "danger" ? "bg-red-50" : "bg-[var(--hover)]",
        )}
      >
        <Icon
          className={cn(
            "h-[18px] w-[18px]",
            tone === "danger" ? "text-red-500" : "text-[var(--muted)]",
          )}
          aria-hidden
        />
      </span>
      <span className="flex-1 text-left">{children}</span>
      {right && (
        <span className={cn("shrink-0 text-[11px]", tone === "danger" ? "text-red-400" : "text-[var(--muted)]")}>
          {right}
        </span>
      )}
    </button>
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
