import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth callback — server Route Handler.
 *
 * Requires Supabase "Implicit Grant" to be DISABLED in the dashboard
 * (Authentication → Sign In / Providers → Email → uncheck Implicit Grant).
 *
 * With implicit grant off, Supabase sends query params instead of a hash:
 *   Invite / magic-link:  ?token_hash=...&type=invite
 *   PKCE:                 ?code=...
 *
 * Query params are visible server-side. Cookies are written directly onto
 * the redirect response so the session persists through the hard redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const successResponse = NextResponse.redirect(`${origin}/setup/invited`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            successResponse.cookies.set(name, value, options ?? {});
          });
        },
      },
    },
  );

  if (token_hash && type) {
    // Invite / magic-link / OTP flow
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "invite" | "recovery" | "email" | "email_change" | "magiclink",
    });
    if (!error) return successResponse;
    console.error("[auth/callback] verifyOtp error:", error.message);
  } else if (code) {
    // PKCE flow
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return successResponse;
    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=invalid_link`);
}
