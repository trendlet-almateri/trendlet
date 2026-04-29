import { createServiceClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types/database";

export type TeamMember = {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: Role[];
  region: string | null;
  invited_at: string | null;
  joined_at: string | null;
  last_seen_at: string | null;
};

export type PendingInvitation = {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
  region: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

/**
 * Fetch all team members (active + inactive) for the admin team page.
 * Joins profiles with user_roles aggregation.
 */
export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from("profiles")
    .select(
      "id, email, full_name, is_active, region, invited_at, joined_at, last_seen_at, user_roles(role)",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((p) => {
    const roles = (
      (p as unknown as { user_roles: { role: Role }[] }).user_roles ?? []
    ).map((r) => r.role);
    return {
      id: p.id,
      email: p.email as string,
      full_name: p.full_name,
      is_active: p.is_active,
      roles,
      region: p.region,
      invited_at: p.invited_at,
      joined_at: p.joined_at,
      last_seen_at: p.last_seen_at,
    };
  });
}

export async function fetchPendingInvitations(): Promise<PendingInvitation[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("invitations")
    .select("id, email, full_name, roles, region, expires_at, accepted_at, created_at")
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    email: r.email as string,
    full_name: r.full_name,
    roles: r.roles ?? [],
    region: r.region,
    expires_at: r.expires_at,
    accepted_at: r.accepted_at,
    created_at: r.created_at,
  }));
}
