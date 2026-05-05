import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

/**
 * Auth callback Route Handler.
 *
 * Route Handlers can set cookies (unlike Server Components), so this is
 * the correct place to exchange Supabase OTP tokens (invite, recovery, etc.)
 * before redirecting the user onward.
 *
 * Invite flow:
 *   email link → /auth/callback?token_hash=...&type=invite&next=/setup/invited
 *   → verifyOtp (sets session cookie) → redirect to /setup/invited
 *   → SetupPage reads session, shows password form (no token needed there)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const type      = searchParams.get("type");
  const next      = searchParams.get("next") ?? "/";

  if (tokenHash && type) {
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options ?? {}),
            );
          },
        },
      },
    );

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "invite" | "signup" | "recovery" | "email_change",
    });

    if (!error) {
      return response;
    }
  }

  // Token missing or invalid → back to login with error flag
  return NextResponse.redirect(`${origin}/login?error=invalid_link`);
}
