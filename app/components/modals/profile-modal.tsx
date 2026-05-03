"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, CircleUser, Globe, Mail, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESENCE_OPTIONS = [
  { key: "online",  label: "Online",  dot: "bg-[var(--green)]" },
  { key: "busy",    label: "Busy",    dot: "bg-[var(--rose)]" },
  { key: "away",    label: "Away",    dot: "bg-[var(--amber)]" },
  { key: "offline", label: "Offline", dot: "bg-[var(--muted-2)]" },
] as const;

const AVATAR_COLORS = [
  "bg-violet-500","bg-blue-500","bg-emerald-500","bg-amber-500",
  "bg-rose-500","bg-cyan-500","bg-orange-500","bg-indigo-500",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

type Props = {
  fullName: string;
  email: string;
  primaryRole: string;
  initials: string;
  onClose: () => void;
};

export function ProfileModal({ fullName, email, primaryRole, initials, onClose }: Props) {
  const [presence, setPresence] = React.useState<"online" | "busy" | "away" | "offline">("online");
  const avatarCls = avatarColor(fullName);

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const activeDot = PRESENCE_OPTIONS.find((p) => p.key === presence)!.dot;

  const content = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[rgba(15,20,25,0.5)]" style={{ animation: "backdropIn 0.2s ease forwards" }} onClick={onClose} />
      <div className="relative flex h-[520px] w-full max-w-[760px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-md)]" style={{ animation: "riseIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards" }}>

        {/* Sidebar */}
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--hover)]">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]">
              <CircleUser className="h-4 w-4 text-white" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-[var(--ink)]">Profile</span>
              <span className="text-[11px] text-[var(--muted)]">Your account</span>
            </div>
          </div>
          <div className="mx-3 h-px bg-[var(--line)]" />
          <nav className="flex flex-col gap-0.5 p-2 pt-3">
            {[
              { icon: CircleUser, label: "Profile & presence", active: true },
              { icon: Globe, label: "Region & language", active: false },
              { icon: Mail, label: "Notifications", active: false },
              { icon: Shield, label: "Security", active: false },
            ].map(({ icon: Icon, label, active }) => (
              <div key={label} className={cn(
                "flex cursor-default items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px]",
                active ? "bg-[var(--accent)]/10 font-medium text-[var(--accent)]" : "text-[var(--muted)]",
              )}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--ink)]">Profile &amp; presence</h2>
              <p className="text-[12px] text-[var(--muted)]">Manage your identity and availability status.</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* Avatar */}
            <div className="mb-6 flex items-center gap-4">
              <span className={cn("relative grid h-16 w-16 shrink-0 place-items-center rounded-full text-[20px] font-bold text-white", avatarCls)}>
                {initials}
                <span className={cn("absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-2 border-white", activeDot)} />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-[var(--ink)]">{fullName}</p>
                <p className="text-[12px] text-[var(--muted)]">{email}</p>
                <span className="mt-1 inline-block rounded-full border border-[var(--line)] bg-[var(--hover)] px-2 py-px text-[10px] font-medium capitalize text-[var(--muted)]">{primaryRole}</span>
              </div>
            </div>

            {/* Presence */}
            <div className="mb-6">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Presence</p>
              <div className="grid grid-cols-2 gap-2">
                {PRESENCE_OPTIONS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPresence(p.key)}
                    className={cn(
                      "flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2.5 text-[13px] transition-colors",
                      presence === p.key
                        ? "border-[var(--accent)]/30 bg-[var(--accent)]/8 font-medium text-[var(--accent)]"
                        : "border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:bg-[var(--hover)]",
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", p.dot)} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Info rows */}
            <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] divide-y divide-[var(--line)]">
              {[
                { label: "Full name", value: fullName },
                { label: "Email", value: email },
                { label: "Role", value: <span className="capitalize">{primaryRole}</span> },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-[12px] text-[var(--muted)]">{label}</span>
                  <span className="text-[13px] font-medium text-[var(--ink)]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
