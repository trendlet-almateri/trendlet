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

export type AssignmentByEmployee = {
  user_id: string;
  full_name: string;
  email: string;
  roles: string[];
  region: "US" | "EU" | "KSA" | "GLOBAL" | null;
  brands: { brand_id: string; name: string; region: "US" | "EU" | "KSA" | "GLOBAL" | null }[];
};

export type OrphanBrand = {
  brand_name_raw: string;
  sub_order_count: number;
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
    .eq("is_active", true)
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
 * List active employees eligible to be a brand's primary assignee.
 * Admins are excluded — only sourcing / fulfiller / warehouse roles can be primaries.
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

  return (profiles ?? [])
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      roles: rolesByUser.get(p.id) ?? [],
    }))
    .filter((p) => p.roles.some((r) => r !== "admin"));
}

/**
 * Group every non-admin active employee with the brands they're primary on.
 * Employees with no brands still appear (empty brand list) so admin sees who is free.
 */
export async function fetchAssignmentsByEmployee(): Promise<AssignmentByEmployee[]> {
  const sb = createServiceClient();

  const { data: profiles, error: profErr } = await sb
    .from("profiles")
    .select("id, full_name, email, region")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (profErr) throw new Error(profErr.message);

  const profileIds = (profiles ?? []).map((p) => p.id);
  if (profileIds.length === 0) return [];

  const { data: roleRows, error: roleErr } = await sb
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", profileIds);
  if (roleErr) throw new Error(roleErr.message);

  const rolesByUser = new Map<string, string[]>();
  for (const r of roleRows ?? []) {
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push(r.role);
    rolesByUser.set(r.user_id, list);
  }

  const { data: assignments, error: assignErr } = await sb
    .from("brand_assignments")
    .select("user_id, brand:brands ( id, name, region )")
    .eq("is_primary", true)
    .in("user_id", profileIds);
  if (assignErr) throw new Error(assignErr.message);

  const brandsByUser = new Map<
    string,
    AssignmentByEmployee["brands"]
  >();
  for (const a of assignments ?? []) {
    const brand = (a as { brand?: { id: string; name: string; region: string | null } | null }).brand;
    if (!brand) continue;
    const list = brandsByUser.get((a as { user_id: string }).user_id) ?? [];
    list.push({
      brand_id: brand.id,
      name: brand.name,
      region: (brand.region as AssignmentByEmployee["region"]) ?? null,
    });
    brandsByUser.set((a as { user_id: string }).user_id, list);
  }

  return (profiles ?? [])
    .map((p) => ({
      user_id: p.id,
      full_name: p.full_name,
      email: p.email,
      region: (p.region as AssignmentByEmployee["region"]) ?? null,
      roles: rolesByUser.get(p.id) ?? [],
      brands: (brandsByUser.get(p.id) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    }))
    .filter((p) => p.roles.some((r) => r !== "admin"));
}

/**
 * List distinct brand_name_raw values from sub_orders that have no
 * brand_id link AND whose name doesn't already match an active brand
 * (case-insensitive). Names that already exist as a brand belong in
 * the unassigned-orders queue, not in this "unknown brands" panel —
 * the brand_id needs a backfill, not a new brand row.
 */
export async function fetchOrphanBrands(): Promise<OrphanBrand[]> {
  const sb = createServiceClient();

  const [{ data: rawRows, error: rawErr }, { data: activeBrands, error: brandErr }] =
    await Promise.all([
      sb.from("sub_orders").select("brand_name_raw").is("brand_id", null),
      sb.from("brands").select("name").eq("is_active", true),
    ]);
  if (rawErr) throw new Error(rawErr.message);
  if (brandErr) throw new Error(brandErr.message);

  const knownLower = new Set(
    (activeBrands ?? []).map((b) => (b.name as string).trim().toLowerCase()),
  );

  const counts = new Map<string, number>();
  for (const row of rawRows ?? []) {
    const raw = ((row as { brand_name_raw: string | null }).brand_name_raw ?? "").trim();
    if (!raw) continue;
    if (knownLower.has(raw.toLowerCase())) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([brand_name_raw, sub_order_count]) => ({ brand_name_raw, sub_order_count }))
    .sort((a, b) => b.sub_order_count - a.sub_order_count);
}
