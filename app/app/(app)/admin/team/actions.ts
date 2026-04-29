"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types/database";

const ROLE_VALUES: Role[] = [
  "admin",
  "sourcing",
  "warehouse",
  "fulfiller",
  "ksa_operator",
];

const inviteSchema = z.object({
  email: z.string().email().max(254),
  full_name: z.string().min(1).max(120),
  role: z.enum(ROLE_VALUES as [Role, ...Role[]]),
  region: z.enum(["US", "EU", "KSA", "GLOBAL"]).optional().or(z.literal("")),
});

export type InviteState = { ok: boolean; error: string | null };

/**
 * Admin invites a new team member. Uses Supabase's built-in
 * inviteUserByEmail which:
 *   1. creates an auth user (no password yet)
 *   2. emails them a /setup link with a token_hash
 *   3. they verify, set a password, and the JWT hook attaches roles
 *
 * We also seed a row in user_roles + insert into invitations for our
 * own audit trail (separate from the Supabase invite token).
 */
export async function inviteTeamMemberAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const admin = await requireAdmin();

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
    region: formData.get("region"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const sb = createServiceClient();

  const region = parsed.data.region === "" ? null : parsed.data.region ?? null;

  // Step 1: create the auth user via invite (sends email).
  const { data: invited, error: inviteErr } = await sb.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: {
        full_name: parsed.data.full_name,
        roles: [parsed.data.role],
      },
    },
  );

  if (inviteErr || !invited.user) {
    return {
      ok: false,
      error: inviteErr?.message ?? "Failed to send invitation.",
    };
  }

  // Step 2: ensure the profile row exists (the auth hook usually creates
  // it but we set the human fields explicitly so they're not '?').
  await sb
    .from("profiles")
    .upsert(
      {
        id: invited.user.id,
        email: parsed.data.email,
        full_name: parsed.data.full_name,
        region,
        is_active: true,
        invited_by: admin.id,
        invited_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

  // Step 3: assign the role.
  await sb
    .from("user_roles")
    .upsert(
      {
        user_id: invited.user.id,
        role: parsed.data.role,
        granted_by: admin.id,
      },
      { onConflict: "user_id,role" },
    );

  // Step 4: audit trail in invitations table.
  await sb.from("invitations").insert({
    email: parsed.data.email,
    full_name: parsed.data.full_name,
    roles: [parsed.data.role],
    region,
    token: invited.user.id, // not actually used to redeem; the Supabase token_hash is in the email
    invited_by: admin.id,
  });

  revalidatePath("/admin/team");
  return { ok: true, error: null };
}

/* ── deactivate ──────────────────────────────────────────────────────── */

const deactivateSchema = z.object({
  userId: z.string().uuid(),
  active: z.boolean(),
});

export type ToggleActiveState = { ok: boolean; error: string | null };

export async function setTeamMemberActiveAction(input: {
  userId: string;
  active: boolean;
}): Promise<ToggleActiveState> {
  const admin = await requireAdmin();

  const parsed = deactivateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  if (parsed.data.userId === admin.id) {
    return { ok: false, error: "You can't deactivate yourself." };
  }

  const sb = createServiceClient();
  const { error } = await sb
    .from("profiles")
    .update({ is_active: parsed.data.active })
    .eq("id", parsed.data.userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/team");
  return { ok: true, error: null };
}
