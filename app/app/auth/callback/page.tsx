"use client";

/**
 * Auth callback page — handles ALL Supabase redirect flows:
 *
 * 1. Implicit flow (invite/magic-link):
 *    Supabase redirects here with #access_token=...&refresh_token=...&type=invite
 *    The hash is client-side only — servers can't read it.
 *    createBrowserClient auto-detects it via detectSessionInUrl() and sets cookies.
 *
 * 2. OTP / token_hash flow:
 *    Supabase redirects with ?token_hash=...&type=invite
 *    We call verifyOtp() client-side; createBrowserClient stores session in cookies.
 *
 * 3. PKCE flow:
 *    Supabase redirects with ?code=...
 *    We call exchangeCodeForSession(); session stored in cookies.
 *
 * In all cases the session ends up in cookies, so the /setup/invited server
 * component can read it via getUser().
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function AuthCallbackPage() {
  const router = useRouter();

  React.useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    async function handle() {
      // ── 1. Implicit flow ──────────────────────────────────────────────────
      // createBrowserClient calls detectSessionInUrl() on init, which reads
      // the #access_token hash and sets the session in cookies automatically.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace("/setup/invited");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const token_hash = params.get("token_hash");
      const type = params.get("type") as
        | "invite" | "recovery" | "email" | "email_change" | "magiclink"
        | null;
      const code = params.get("code");

      // ── 2. OTP / token_hash flow ──────────────────────────────────────────
      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type });
        if (!error) {
          router.replace("/setup/invited");
          return;
        }
        console.error("[auth/callback] verifyOtp error:", error.message);
      }

      // ── 3. PKCE fallback ─────────────────────────────────────────────────
      else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          router.replace("/setup/invited");
          return;
        }
        console.error("[auth/callback] exchangeCodeForSession error:", error.message);
      }

      router.replace("/login?error=invalid_link");
    }

    handle();
  }, [router]);

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
