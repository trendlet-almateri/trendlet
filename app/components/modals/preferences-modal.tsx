"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, Settings2, Globe, Bell, SunMedium } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { onClose: () => void };

export function PreferencesModal({ onClose }: Props) {
  const [lang, setLang] = React.useState<"en" | "ar">("en");
  const [currency, setCurrency] = React.useState<"SAR" | "USD" | "EUR">("SAR");
  const [notifs, setNotifs] = React.useState(true);

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const content = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[rgba(15,20,25,0.5)]" style={{ animation: "backdropIn 0.2s ease forwards" }} onClick={onClose} />
      <div className="relative flex h-[520px] w-full max-w-[760px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-md)]" style={{ animation: "riseIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards" }}>

        {/* Sidebar */}
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--hover)]">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]">
              <Settings2 className="h-4 w-4 text-white" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-[var(--ink)]">Preferences</span>
              <span className="text-[11px] text-[var(--muted)]">Your settings</span>
            </div>
          </div>
          <div className="mx-3 h-px bg-[var(--line)]" />
          <nav className="flex flex-col gap-0.5 p-2 pt-3">
            {[
              { icon: Globe, label: "Language & region", active: true },
              { icon: Bell, label: "Notifications", active: false },
              { icon: SunMedium, label: "Appearance", active: false },
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
              <h2 className="text-[16px] font-semibold text-[var(--ink)]">My preferences</h2>
              <p className="text-[12px] text-[var(--muted)]">Customize your workspace experience.</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
            {/* Language */}
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

            {/* Currency */}
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

            {/* Notifications */}
            <section>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Notifications</p>
              <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] divide-y divide-[var(--line)]">
                {[
                  { label: "Order alerts", sub: "Unassigned, delayed, SLA at risk", on: notifs, toggle: () => setNotifs((v) => !v) },
                  { label: "Invoice updates", sub: "Approvals, rejections, due dates", on: true, toggle: () => {} },
                  { label: "Team activity", sub: "Invites, role changes", on: false, toggle: () => {} },
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
            </section>

            {/* Appearance */}
            <section>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Appearance</p>
              <div className="flex gap-2">
                <div className={cn("flex-1 rounded-[var(--radius-sm)] border border-[var(--accent)]/30 bg-[var(--accent)]/10 py-2.5 text-center text-[13px] font-medium text-[var(--accent)]")}>
                  Light
                </div>
                <div className="flex-1 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--panel)] py-2.5 text-center text-[13px] font-medium text-[var(--muted)] opacity-40 cursor-not-allowed">
                  Dark (soon)
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
