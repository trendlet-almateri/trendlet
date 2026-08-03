/**
 * Shared formatter for "who performed this action" audit lines.
 *
 * Admin-only feature: callers must only pass a `changer` embed when the
 * viewer is an admin (the identity is stripped server-side otherwise). This
 * helper just turns the embedded profile + roles into a display name/role,
 * with a graceful "System" fallback for historical rows and the webhook
 * system user (no full_name).
 *
 * The embed shape matches a Supabase join like:
 *   changer:profiles!<fk> ( full_name, user_roles ( role ) )
 */
export type PerformerEmbed = {
  full_name: string | null;
  user_roles?: { role: string }[] | null;
} | null;

export type Performer = { name: string; role: string | null };

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  sourcing: "Sourcing",
  warehouse: "Warehouse",
  fulfiller: "Fulfiller",
  ksa_operator: "KSA Operator",
};

export function formatPerformer(changer: PerformerEmbed): Performer {
  const name = changer?.full_name?.trim() || "System";
  const roles = (changer?.user_roles ?? []).map((r) => r.role);
  // Prefer "admin" when present (highest privilege), else the first role.
  const key = roles.includes("admin") ? "admin" : (roles[0] ?? null);
  const role = key ? (ROLE_LABELS[key] ?? key) : null;
  return { name, role };
}
