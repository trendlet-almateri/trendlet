import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  // Build the success redirect first so we can attach session cookies to it.
  // Cookies MUST be written to the response object — writing to cookies() from
  // next/headers loses the writes on a redirect and the session never persists.
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
    // Invite / magic-link / OTP flow — Supabase appends ?token_hash=...&type=invite
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "invite" | "recovery" | "email" | "email_change" | "magiclink",
    });
    if (!error) return successResponse;
    console.error("[auth/callback] verifyOtp error:", error.message);
  } else if (code) {
    // PKCE flow fallback
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return successResponse;
    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=invalid_link`);
}
