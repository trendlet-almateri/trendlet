"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X, ShieldCheck, Key, Smartphone, MonitorSmartphone, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { email: string; onClose: () => void };

export function SecurityModal({ email, onClose }: Props) {
  const [twoFA, setTwoFA] = React.useState(false);

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const content = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[rgba(15,20,25,0.5)]" style={{ animation: "backdropIn 0.2s ease forwards" }} onClick={onClose} />
      <div className="relative flex h-[560px] w-full max-w-[760px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-md)]" style={{ animation: "riseIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards" }}>

        {/* Sidebar */}
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--hover)]">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]">
              <ShieldCheck className="h-4 w-4 text-white" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-[var(--ink)]">Security</span>
              <span className="text-[11px] text-[var(--muted)]">Account protection</span>
            </div>
          </div>
          <div className="mx-3 h-px bg-[var(--line)]" />
          <nav className="flex flex-col gap-0.5 p-2 pt-3">
            {[
              { icon: ShieldCheck, label: "Authentication",  active: true },
              { icon: MonitorSmartphone, label: "Sessions",  active: false },
              { icon: Key,          label: "API keys",       active: false },
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
          <div className="flex-1" />
          <div className="border-t border-[var(--line)] p-4">
            <div className={cn("flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2",
              twoFA ? "border-[var(--green)]/30 bg-[var(--green-bg)]" : "border-[var(--amber)]/30 bg-[var(--amber-bg)]")}>
              <span className={cn("h-2 w-2 rounded-full", twoFA ? "bg-[var(--green)]" : "bg-[var(--amber)]")} />
              <span className={cn("text-[11px] font-semibold", twoFA ? "text-[var(--green)]" : "text-[var(--amber)]")}>
                2FA {twoFA ? "enabled" : "disabled"}
              </span>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-start justify-between border-b border-[var(--line)] px-6 py-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--ink)]">Security</h2>
              <p className="text-[12px] text-[var(--muted)]">Manage authentication, sessions, and access control.</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
            {/* 2FA */}
            <section>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Two-factor authentication</p>
              <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)]">
                <div className="flex items-center justify-between px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--line)] bg-[var(--hover)]">
                      <Smartphone className="h-4 w-4 text-[var(--muted)]" />
                    </span>
                    <div>
                      <p className="text-[13px] font-medium text-[var(--ink)]">Authenticator app</p>
                      <p className="text-[11px] text-[var(--muted)]">{twoFA ? "Active — TOTP via authenticator app" : "Not configured"}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setTwoFA((v) => !v)}
                    className={cn("relative h-5 w-9 rounded-full transition-colors", twoFA ? "bg-[var(--accent)]" : "bg-[var(--line)]")}>
                    <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", twoFA ? "translate-x-4" : "translate-x-0.5")} />
                  </button>
                </div>
              </div>
            </section>

            {/* Password */}
            <section>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Password</p>
              <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] divide-y divide-[var(--line)]">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-[13px] font-medium text-[var(--ink)]">Account password</p>
                    <p className="text-[11px] text-[var(--muted)]">{email}</p>
                  </div>
                  <button type="button" className="text-[12px] font-medium text-[var(--accent)] transition-opacity hover:opacity-70">
                    Change password
                  </button>
                </div>
              </div>
            </section>

            {/* Sessions */}
            <section>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Active sessions</p>
              <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] divide-y divide-[var(--line)]">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <MonitorSmartphone className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                    <div>
                      <p className="text-[13px] font-medium text-[var(--ink)]">Current session</p>
                      <p className="text-[11px] text-[var(--muted)]">Browser · Active now</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-[var(--green)]/30 bg-[var(--green-bg)] px-2 py-px text-[10px] font-semibold text-[var(--green)]">This device</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <button type="button" className="flex items-center gap-2 text-[12px] font-medium text-[var(--rose)] transition-opacity hover:opacity-70">
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out all other sessions
                  </button>
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
