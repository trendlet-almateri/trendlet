import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

type CookieSet = { name: string; value: string; options?: CookieOptions };

export function createClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components can't set cookies; ignored — middleware refreshes session.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. SERVER-ONLY. Used for admin pricing reads, webhook
 * processing, and cron jobs. Bypasses RLS — never call from a route accessible
 * to non-admin users without re-checking auth first.
 */
export function createServiceClient() {
  if (typeof window !== "undefined") {
    throw new Error("Service-role client must never be used on the client.");
  }
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: (_: CookieSet[]) => {},
      },
    },
  );
}
