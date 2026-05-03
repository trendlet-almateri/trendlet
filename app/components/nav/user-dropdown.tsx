"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronUp,
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

type UserDropdownProps = {
  fullName: string;
  email: string;
  primaryRole: string;
  initials: string;
  unassignedCount: number;
};

export function UserDropdown({
  fullName,
  email,
  primaryRole,
  initials,
  unassignedCount,
}: UserDropdownProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
          "hover:bg-white/[0.07] focus:bg-white/[0.07] focus:outline-none",
          "data-[state=open]:bg-white/[0.07]",
        )}
        aria-label="Open account menu"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-[13px] font-semibold text-white">
          {initials}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13px] font-medium text-neutral-100">{fullName}</span>
          <span className="truncate text-[11px] text-neutral-400 capitalize">{primaryRole}</span>
        </span>
        <ChevronUp className="ml-auto h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="right"
          align="end"
          sideOffset={12}
          alignOffset={0}
          className={cn(
            "z-50 w-[280px] rounded-xl border border-white/[0.08] bg-[#1a1d22] p-1.5",
            "shadow-[0_16px_48px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:slide-in-from-left-2 data-[state=closed]:slide-out-to-left-2",
          )}
        >
          {/* Profile header */}
          <div className="flex items-center gap-3 px-3 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy text-[14px] font-semibold text-white">
              {initials}
            </span>
            <div className="flex min-w-0 flex-col leading-snug">
              <span className="truncate text-[13px] font-semibold text-white">{fullName}</span>
              <span className="truncate text-[11px] text-neutral-400">
                {email} · <span className="capitalize">{primaryRole}</span>
              </span>
            </div>
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-white/[0.06]" />

          {/* ACCOUNT */}
          <SectionLabel>Account</SectionLabel>
          <Item icon={CircleUser} href="/profile" right={<OnlinePill />}>
            Profile & presence
          </Item>
          <Item icon={Settings2} href="/preferences" right="EN · SAR">
            My preferences
          </Item>

          <DropdownMenu.Separator className="my-1 h-px bg-white/[0.06]" />

          {/* QUEUE */}
          <SectionLabel>Queue</SectionLabel>
          <Item
            icon={AlertTriangle}
            href="/orders/unassigned"
            right={
              unassignedCount > 0 ? (
                <span className="rounded-full bg-[#791F1F] px-1.5 py-px text-[10px] font-medium text-white tabular-nums">
                  {unassignedCount}
                </span>
              ) : null
            }
            tone={unassignedCount > 0 ? "danger" : undefined}
          >
            Unassigned sub-orders
          </Item>

          <DropdownMenu.Separator className="my-1 h-px bg-white/[0.06]" />

          {/* WORKSPACE SETUP */}
          <SectionLabel>Workspace setup</SectionLabel>
          <Item icon={Store} href="/setup/stores" right="0 active">
            Stores
          </Item>
          <Item icon={Tag} href="/setup/brands" right="0 brands">
            Brands & assignments
          </Item>
          <Item icon={Users} href="/setup/team" right="1 member">
            Team & roles
          </Item>
          <Item icon={Truck} href="/setup/carriers" right="3 active">
            Carriers
          </Item>
          <Item icon={Plug} href="/setup/integrations" right="4 active">
            Integrations
          </Item>
          <Item icon={ShieldCheck} href="/setup/security" right="2FA off">
            Security
          </Item>

          <DropdownMenu.Separator className="my-1 h-px bg-white/[0.06]" />

          {/* Sign out */}
          <DropdownMenu.Item
            onSelect={(e) => {
              e.preventDefault();
              void signOut();
            }}
            disabled={signingOut}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] outline-none",
              "text-[#F09595] hover:bg-[#791F1F]/20 focus:bg-[#791F1F]/20",
              "data-[disabled]:opacity-50",
            )}
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            <span>{signingOut ? "Signing out…" : "Sign out"}</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.5px] text-neutral-500">
      {children}
    </div>
  );
}

type ItemProps = {
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  tone?: "danger";
};

function Item({ icon: Icon, href, children, right, tone }: ItemProps) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href}
        className={cn(
          "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors",
          "text-neutral-200 hover:bg-white/[0.06] focus:bg-white/[0.06]",
          tone === "danger" && "bg-[#791F1F]/15 text-[#FCD3D3] hover:bg-[#791F1F]/25",
        )}
      >
        <Icon className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
        <span className="flex-1 truncate">{children}</span>
        {right && (
          <span className="shrink-0 text-[11px] text-neutral-500">{right}</span>
        )}
      </Link>
    </DropdownMenu.Item>
  );
}

function OnlinePill() {
  return (
    <span className="flex items-center gap-1 text-[11px] text-neutral-400">
      <span className="h-1.5 w-1.5 rounded-full bg-[#5DCAA5]" aria-hidden />
      Online
    </span>
  );
}
