"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";

export type AliasActionState = { ok: boolean; error: string | null };

const setSchema = z.object({
  app_brand_name: z.string().trim().min(1, "Brand is required."),
  // Zero or more pricing brand names this app brand maps to.
  pricing_brands: z.array(z.string().trim().min(1)),
});

/**
 * Replace ALL pricing-brand aliases for one app brand with the given set
 * (delete-then-insert, so unticking a box removes it). An empty set clears the
 * brand's aliases entirely — it then prices only via name-match or manual entry.
 */
export async function setBrandAliasesAction(
  _prev: AliasActionState,
  formData: FormData,
): Promise<AliasActionState> {
  await requireAdmin();

  let pricingBrands: unknown = [];
  try {
    const raw = formData.get("pricing_brands_json");
    pricingBrands = typeof raw === "string" ? JSON.parse(raw) : [];
  } catch {
    return { ok: false, error: "Invalid selection." };
  }

  const parsed = setSchema.safeParse({
    app_brand_name: formData.get("app_brand_name"),
    pricing_brands: pricingBrands,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { app_brand_name, pricing_brands } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;

  // Clear existing aliases for this brand, then insert the new set.
  const { error: delErr } = await sb
    .from("brand_pricing_aliases")
    .delete()
    .ilike("app_brand_name", app_brand_name);
  if (delErr) return { ok: false, error: delErr.message };

  if (pricing_brands.length > 0) {
    const rows = [...new Set(pricing_brands)].map((pricing_brand_name) => ({
      app_brand_name,
      pricing_brand_name,
    }));
    const { error: insErr } = await sb.from("brand_pricing_aliases").insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidatePath("/admin/brand-pricing");
  return { ok: true, error: null };
}
