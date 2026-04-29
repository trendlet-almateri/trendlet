import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { ModelPickerForm } from "./model-picker-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Invoice settings · Trendslet Operations" };

/**
 * Admin-only: pick which AI model is used to extract data from supplier
 * receipts. Stored in settings.ocr_model_id; read by the Phase 4f
 * extraction server action.
 */
export default async function InvoiceSettingsPage() {
  await requireAdmin();

  const sb = createServiceClient();

  const [{ data: models }, { data: setting }] = await Promise.all([
    sb
      .from("ai_models")
      .select("id, provider, model_id, display_name, cost_per_1k_input, cost_per_1k_output, is_active")
      .eq("use_case", "ocr")
      .eq("is_active", true)
      .order("cost_per_1k_input", { ascending: true }),
    sb
      .from("settings")
      .select("value")
      .eq("key", "ocr_model_id")
      .maybeSingle(),
  ]);

  const currentModelId =
    typeof setting?.value === "string" ? setting.value : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-h1 text-ink-primary">Invoice settings</h1>
        <span className="text-[12px] text-ink-tertiary">
          Choose which AI model extracts line items from supplier receipts.
        </span>
      </header>

      <ModelPickerForm
        currentModelId={currentModelId}
        models={(models ?? []).map((m) => ({
          id: m.id,
          model_id: m.model_id,
          provider: m.provider,
          display_name: m.display_name,
          cost_per_1k_input: m.cost_per_1k_input,
          cost_per_1k_output: m.cost_per_1k_output,
        }))}
      />
    </div>
  );
}
