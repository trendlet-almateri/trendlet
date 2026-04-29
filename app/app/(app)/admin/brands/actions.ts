"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";

export type BrandActionState = { ok: boolean; error: string | null };

const nameSchema = z
  .string()
  .trim()
  .min(1, "Brand name is required.")
  .max(120, "Brand name is too long.");

const regionSchema = z.enum(["US", "EU", "KSA", "GLOBAL"]).nullable();

const markupSchema = z.coerce
  .number()
  .min(0, "Markup must be 0 or greater.")
  .max(999.99, "Markup is too high.");

const assigneeSchema = z
  .string()
  .refine((v) => v === "" || /^[0-9a-f-]{36}$/i.test(v), "Invalid id.");

const updateSchema = z.object({
  brand_id: z.string().uuid(),
  name: nameSchema,
  region: regionSchema,
  markup_percent: markupSchema,
  /** UUID of the profile to set as primary assignee. Empty string clears. */
  primary_assignee_id: assigneeSchema,
});

const createSchema = z.object({
  name: nameSchema,
  region: regionSchema,
  markup_percent: markupSchema,
  primary_assignee_id: assigneeSchema,
});

/**
 * Update a brand's region, markup_percent, and primary assignee.
 *
 * Primary assignee is stored on `brand_assignments.is_primary`. We swap
 * it atomically: clear all `is_primary=true` for this brand, then upsert
 * a single row for the chosen assignee with `is_primary=true`. Empty
 * string means "no primary" — clears any existing.
 */
export async function updateBrandAction(
  _prev: BrandActionState,
  formData: FormData,
): Promise<BrandActionState> {
  await requireAdmin();

  const parsed = updateSchema.safeParse({
    brand_id: formData.get("brand_id"),
    name: formData.get("name"),
    region: formData.get("region") || null,
    markup_percent: formData.get("markup_percent"),
    primary_assignee_id: formData.get("primary_assignee_id") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const sb = createServiceClient();

  // 1. Update brand row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: brandErr } = await (sb.from("brands") as any)
    .update({
      name: parsed.data.name,
      region: parsed.data.region,
      markup_percent: parsed.data.markup_percent,
    })
    .eq("id", parsed.data.brand_id);
  if (brandErr) return { ok: false, error: brandErr.message };

  // 2. Reset all primary flags on this brand. (Keeps non-primary
  //    assignment rows intact — only the primary flag is cleared.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: clearErr } = await (sb.from("brand_assignments") as any)
    .update({ is_primary: false })
    .eq("brand_id", parsed.data.brand_id)
    .eq("is_primary", true);
  if (clearErr) return { ok: false, error: clearErr.message };

  // 3. If a new primary was chosen, upsert that row with is_primary=true.
  //    Existing (brand, user) pair just flips is_primary; new pair inserts.
  if (parsed.data.primary_assignee_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertErr } = await (sb.from("brand_assignments") as any)
      .upsert(
        {
          brand_id: parsed.data.brand_id,
          user_id: parsed.data.primary_assignee_id,
          is_primary: true,
        },
        { onConflict: "brand_id,user_id" },
      );
    if (upsertErr) return { ok: false, error: upsertErr.message };
  }

  revalidatePath("/admin/brands");
  return { ok: true, error: null };
}

/**
 * Create a brand the admin manually defined (i.e. before any Shopify
 * webhook would have auto-created it). brands.name has a UNIQUE
 * constraint — duplicate inserts surface a friendly error message.
 *
 * Optionally sets the primary brand assignment in the same call so the
 * admin can configure routing in one go.
 */
export async function createBrandAction(
  _prev: BrandActionState,
  formData: FormData,
): Promise<BrandActionState> {
  await requireAdmin();

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    region: formData.get("region") || null,
    markup_percent: formData.get("markup_percent"),
    primary_assignee_id: formData.get("primary_assignee_id") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const sb = createServiceClient();

  // 1. Insert the brand. brands.name has UNIQUE — Postgres returns 23505
  //    on duplicate; surface that as a human-readable message.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brand, error: insertErr } = await (sb.from("brands") as any)
    .insert({
      name: parsed.data.name,
      region: parsed.data.region,
      markup_percent: parsed.data.markup_percent,
    })
    .select("id")
    .single();
  if (insertErr) {
    if (insertErr.code === "23505") {
      return { ok: false, error: `A brand named "${parsed.data.name}" already exists.` };
    }
    return { ok: false, error: insertErr.message };
  }

  // 2. Optionally set the primary assignee in one shot.
  if (parsed.data.primary_assignee_id && brand?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: assignErr } = await (sb.from("brand_assignments") as any).insert({
      brand_id: brand.id,
      user_id: parsed.data.primary_assignee_id,
      is_primary: true,
    });
    if (assignErr) return { ok: false, error: assignErr.message };
  }

  revalidatePath("/admin/brands");
  return { ok: true, error: null };
}
