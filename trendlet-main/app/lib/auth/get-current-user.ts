import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types/database";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  roles: Role[];
  region: "US" | "EU" | "KSA" | null;
};

/**
 * Reads the current user from the Supabase session and pulls roles from the
 * JWT claim populated by the custom_access_token_hook (see migrations).
 *
 * Note: `getUser()` returns the persisted user record, NOT the decoded JWT.
 * The hook injects `user_roles` into the live JWT claims at token mint time,
 * but supabase-js reads `user.app_metadata` from auth.users (which doesn't
 * persist hook output). So the JWT-claim path here only works if the hook
 * is configured to write to app_metadata permanently (most setups don't).
 *
 * The DB fallback uses the service-role client because the regular client
 * is RLS-blocked: `user_roles` policy requires `jwt_is_admin()`, which
 * itself depends on the very claim we're trying to look up — a chicken-and-egg.
 * Scoping to `user_id = user.id` keeps this safe.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Try the JWT-claim fast path first
  const claimRoles = (user.app_metadata?.user_roles ?? user.user_metadata?.user_roles) as
    | string[]
    | undefined;

  let roles: Role[] = (claimRoles ?? []) as Role[];

  // Fallback: DB lookup via service-role (bypasses RLS for this single user_id read)
  if (!roles.length) {
    const admin = createServiceClient();
    const { data } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    roles = ((data as { role: Role }[] | null) ?? []).map((r) => r.role);
  }

  // Profile read also via service-role for the same reason (own profile is
  // readable under RLS, but using one client throughout simplifies the path)
  const admin = createServiceClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, region")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null; region: string | null }>();

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    roles,
    region: (profile?.region as "US" | "EU" | "KSA" | null) ?? null,
  };
}
