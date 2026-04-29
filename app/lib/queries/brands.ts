import { createServiceClient } from "@/lib/supabase/server";

export type BrandRow = {
  id: string;
  name: string;
  region: "US" | "EU" | "KSA" | "GLOBAL" | null;
  is_active: boolean;
  markup_percent: number;
  /** Primary assignee, joined from brand_assignments where is_primary = true. */
  primary_assignee: { user_id: string; full_name: string | null } | null;
};

export type AssigneeOption = {
  id: string;
  full_name: string;
  email: string;
  /** Joined from user_roles. A profile may carry multiple roles. */
  roles: string[];
};

/**
 * List every brand with its primary assignee resolved. Service-role read —
 * called from the admin /admin/brands page only.
 */
export async function fetchBrandsForAdmin(): Promise<BrandRow[]> {
  const sb = createServiceClient();

  const { data: brands, error } = await sb
    .from("brands")
    .select("id, name, region, is_active, markup_percent")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);

  // Fetch primary brand_assignments in one round-trip and attach.
  const { data: assignments } = await sb
    .from("brand_assignments")
    .select("brand_id, user_id, is_primary, profile:profiles ( full_name )")
    .eq("is_primary", true);

  const byBrand = new Map<
    string,
    { user_id: string; full_name: string | null }
  >();
  for (const a of assignments ?? []) {
    const profileRel = (a as { profile?: { full_name: string | null } | null }).profile;
    byBrand.set((a as { brand_id: string }).brand_id, {
      user_id: (a as { user_id: string }).user_id,
      full_name: profileRel?.full_name ?? null,
    });
  }

  return (brands ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    region: (b.region as BrandRow["region"]) ?? null,
    is_active: b.is_active,
    markup_percent: Number(b.markup_percent ?? 0),
    primary_assignee: byBrand.get(b.id) ?? null,
  }));
}

/**
 * List active employees (any non-admin role + admins) eligible to be a
 * brand's primary assignee. Admin can self-assign per Q3.
 *
 * Two queries instead of an embedded join: `user_roles` has dual FKs to
 * `profiles` (`user_id` and `granted_by`), which makes the PostgREST
 * embed ambiguous and 500s.
 */
export async function fetchAssigneeOptions(): Promise<AssigneeOption[]> {
  const sb = createServiceClient();

  const { data: profiles, error } = await sb
    .from("profiles")
    .select("id, full_name, email")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);

  const profileIds = (profiles ?? []).map((p) => p.id);
  let rolesByUser = new Map<string, string[]>();
  if (profileIds.length > 0) {
    const { data: roleRows, error: roleErr } = await sb
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", profileIds);
    if (roleErr) throw new Error(roleErr.message);
    rolesByUser = (roleRows ?? []).reduce((acc, r) => {
      const list = acc.get(r.user_id) ?? [];
      list.push(r.role);
      acc.set(r.user_id, list);
      return acc;
    }, new Map<string, string[]>());
  }

  return (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    roles: rolesByUser.get(p.id) ?? [],
  }));
}
