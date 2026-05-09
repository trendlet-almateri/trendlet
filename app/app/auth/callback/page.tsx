"use client";

import * as React from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function AuthCallbackPage() {
  React.useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    async function handle() {
      // ── 1. Implicit flow — #access_token in URL hash ──────────────────────
      // createBrowserClient uses PKCE mode and won't auto-detect the hash,
      // so we parse it manually and call setSession directly.
      const hash = window.location.hash.slice(1);
      if (hash) {
        const p = new URLSearchParams(hash);
        const access_token = p.get("access_token");
        const refresh_token = p.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error) {
            // Full reload so the server component reads the fresh cookies.
            window.location.href = "/setup/invited";
            return;
          }
          console.error("[auth/callback] setSession error:", error.message);
          window.location.href = "/login?error=invalid_link";
          return;
        }
      }

      // ── 2. OTP / token_hash flow — ?token_hash=...&type=... ───────────────
      const params = new URLSearchParams(window.location.search);
      const token_hash = params.get("token_hash");
      const type = params.get("type") as
        | "invite" | "recovery" | "email" | "email_change" | "magiclink"
        | null;
      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type });
        if (!error) {
          window.location.href = "/setup/invited";
          return;
        }
        console.error("[auth/callback] verifyOtp error:", error.message);
        window.location.href = "/login?error=invalid_link";
        return;
      }

      // ── 3. PKCE fallback — ?code=... ──────────────────────────────────────
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          window.location.href = "/setup/invited";
          return;
        }
        console.error("[auth/callback] exchangeCodeForSession error:", error.message);
      }

      window.location.href = "/login?error=invalid_link";
    }

    handle();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <svg
          className="h-6 w-6 animate-spin text-[var(--accent,#3b82f6)]"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <p className="text-[13px] text-[var(--muted,#6b7280)]">Setting up your account…</p>
      </div>
    </div>
  );
}
