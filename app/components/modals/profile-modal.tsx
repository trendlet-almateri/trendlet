"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, CircleUser, Globe, Bell, SunMedium, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-violet-500","bg-blue-500","bg-emerald-500","bg-amber-500",
  "bg-rose-500","bg-cyan-500","bg-orange-500","bg-indigo-500",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

type Tab = "profile" | "language" | "notifications" | "appearance";

const TABS: { key: Tab; icon: React.ComponentType<{ className?: string }>; label: string; soon?: boolean }[] = [
  { key: "profile",       icon: CircleUser, label: "Profile" },
  { key: "appearance",    icon: SunMedium,  label: "Appearance" },
  { key: "language",      icon: Globe,      label: "Language & region", soon: true },
  { key: "notifications", icon: Bell,       label: "Notifications",     soon: true },
];

type Props = {
  fullName: string;
  email: string;
  primaryRole: string;
  initials: string;
  onClose: () => void;
};

export function ProfileModal({ fullName, email, primaryRole, initials, onClose }: Props) {
  const [activeTab, setActiveTab] = React.useState<Tab>("profile");
  const [lang, setLang] = React.useState<"en" | "ar">("en");
  const [currency, setCurrency] = React.useState<"SAR" | "USD" | "EUR">("SAR");
  const [notifs, setNotifs] = React.useState(true);
  const avatarCls = avatarColor(fullName);

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const activeTabMeta = TABS.find((t) => t.key === activeTab)!;

  const content = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-[rgba(15,20,25,0.5)]" style={{ animation: "backdropIn 0.2s ease forwards" }} onClick={onClose} />
      <div className="relative flex h-[520px] max-h-[calc(100svh-2rem)] w-full max-w-[760px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-md)]" style={{ animation: "riseIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards" }}>

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
            {TABS.map(({ key, icon: Icon, label, soon }) => (
              <button
                key={key}
                type="button"
                onClick={() => !soon && setActiveTab(key)}
                disabled={soon}
                className={cn(
                  "flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] text-left transition-colors",
                  soon
                    ? "cursor-not-allowed text-[var(--muted)] opacity-50"
                    : activeTab === key
                      ? "bg-[var(--accent)]/10 font-medium text-[var(--accent)]"
                      : "text-[var(--muted)] hover:bg-[var(--line)] hover:text-[var(--ink)]",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{label}</span>
                {soon && (
                  <span className="rounded-full bg-[var(--line)] px-1.5 py-px text-[9px] font-medium text-[var(--muted)]">
                    Soon
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--ink)]">{activeTabMeta.label}</h2>
              <p className="text-[12px] text-[var(--muted)]">
                {activeTab === "profile"       && "Manage your account information."}
                {activeTab === "language"      && "Set your language and display currency."}
                {activeTab === "notifications" && "Control which alerts you receive."}
                {activeTab === "appearance"    && "Customize how the app looks."}
              </p>
            </div>
            <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">

            {/* ── Profile tab ── */}
            {activeTab === "profile" && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <span className={cn("grid h-16 w-16 shrink-0 place-items-center rounded-full text-[20px] font-bold text-white", avatarCls)}>
                    {initials}
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-[var(--ink)]">{fullName}</p>
                    <p className="text-[12px] text-[var(--muted)]">{email}</p>
                    <span className="mt-1 inline-block rounded-full border border-[var(--line)] bg-[var(--hover)] px-2 py-px text-[10px] font-medium capitalize text-[var(--muted)]">{primaryRole}</span>
                  </div>
                </div>
                <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] divide-y divide-[var(--line)]">
                  {[
                    { label: "Full name", value: fullName },
                    { label: "Email",     value: email },
                    { label: "Role",      value: <span className="capitalize">{primaryRole}</span> },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between px-4 py-3">
                      <span className="text-[12px] text-[var(--muted)]">{label}</span>
                      <span className="text-[13px] font-medium text-[var(--ink)]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Language & region tab ── */}
            {activeTab === "language" && (
              <div className="flex flex-col gap-6">
                <section>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Language</p>
                  <div className="flex gap-2">
                    {(["en", "ar"] as const).map((l) => (
                      <button key={l} type="button" onClick={() => setLang(l)}
                        className={cn(
                          "flex-1 rounded-[var(--radius-sm)] border py-2.5 text-[13px] font-medium transition-colors",
                          lang === l ? "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:bg-[var(--hover)]",
                        )}
                      >
                        {l === "en" ? "English" : "العربية"}
                      </button>
                    ))}
                  </div>
                </section>
                <section>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Display currency</p>
                  <div className="flex gap-2">
                    {(["SAR", "USD", "EUR"] as const).map((c) => (
                      <button key={c} type="button" onClick={() => setCurrency(c)}
                        className={cn(
                          "flex-1 rounded-[var(--radius-sm)] border py-2.5 text-[13px] font-medium transition-colors",
                          currency === c ? "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:bg-[var(--hover)]",
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* ── Notifications tab ── */}
            {activeTab === "notifications" && (
              <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] divide-y divide-[var(--line)]">
                {[
                  { label: "Order alerts",    sub: "Unassigned, delayed, SLA at risk", on: notifs,  toggle: () => setNotifs((v) => !v) },
                  { label: "Invoice updates", sub: "Approvals, rejections, due dates", on: true,    toggle: () => {} },
                  { label: "Team activity",   sub: "Invites, role changes",            on: false,   toggle: () => {} },
                ].map(({ label, sub, on, toggle }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--ink)]">{label}</p>
                      <p className="text-[11px] text-[var(--muted)]">{sub}</p>
                    </div>
                    <button type="button" onClick={toggle}
                      className={cn("relative h-5 w-9 rounded-full transition-colors", on ? "bg-[var(--accent)]" : "bg-[var(--line)]")}
                    >
                      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", on ? "translate-x-4" : "translate-x-0.5")} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Appearance tab ── */}
            {activeTab === "appearance" && (
              <div className="flex gap-2">
                <div className="flex-1 rounded-[var(--radius-sm)] border border-[var(--accent)]/30 bg-[var(--accent)]/10 py-2.5 text-center text-[13px] font-medium text-[var(--accent)]">
                  Light
                </div>
                <div className="flex-1 cursor-not-allowed rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] py-2.5 text-center text-[13px] font-medium text-[var(--muted)] opacity-40">
                  Dark (soon)
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
