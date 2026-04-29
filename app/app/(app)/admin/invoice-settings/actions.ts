"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";

const schema = z.object({
  modelId: z.string().min(1).max(120),
});

export type SetOcrModelState =
  | { ok: true; error: null }
  | { ok: false; error: string };

/**
 * Admin-only: write the chosen OCR model_id to settings.ocr_model_id.
 * Phase 4f's extraction action reads this value when calling OpenRouter.
 */
export async function setOcrModelAction(input: {
  modelId: string;
}): Promise<SetOcrModelState> {
  const user = await requireAdmin();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const sb = createServiceClient();

  // Validate the model exists and is active for OCR.
  const { data: model, error: mErr } = await sb
    .from("ai_models")
    .select("model_id")
    .eq("model_id", parsed.data.modelId)
    .eq("use_case", "ocr")
    .eq("is_active", true)
    .maybeSingle();
  if (mErr) return { ok: false, error: mErr.message };
  if (!model) {
    return {
      ok: false,
      error: "Model not found, inactive, or not classified for OCR.",
    };
  }

  const { error: upErr } = await sb
    .from("settings")
    .update({
      value: parsed.data.modelId,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("key", "ocr_model_id");
  if (upErr) return { ok: false, error: upErr.message };

  revalidatePath("/admin/invoice-settings");
  return { ok: true, error: null };
}
