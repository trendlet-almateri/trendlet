import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { isZohoInboundConfigured } from "@/lib/integrations/zoho-mail-inbound";
import { PageHeader } from "@/components/system";
import { ModelPickerForm } from "./model-picker-form";
import { InboundPollCard } from "./inbound-poll-card";

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

  const [{ data: models }, { data: setting }, { data: imports }] =
    await Promise.all([
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
      sb
        .from("zoho_inbound_messages")
        .select(
          "message_id, from_address, subject, attachment_count, status, processed_at",
        )
        .order("processed_at", { ascending: false })
        .limit(10),
    ]);

  const currentModelId =
    typeof setting?.value === "string" ? setting.value : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoice settings"
        subtitle="Choose which AI model extracts line items from supplier receipts."
      />

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

      <InboundPollCard
        isConfigured={isZohoInboundConfigured()}
        recentImports={(imports ?? []).map((r) => ({
          message_id: r.message_id,
          from_address: r.from_address,
          subject: r.subject,
          attachment_count: r.attachment_count,
          status: r.status,
          processed_at: r.processed_at,
        }))}
      />
    </div>
  );
}
