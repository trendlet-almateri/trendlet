"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-role";
import { processZohoInbound } from "@/lib/services/process-zoho-inbound";

export type PollNowState =
  | {
      ok: true;
      mode: "live" | "mock";
      messagesScanned: number;
      messagesProcessed: number;
      invoicesCreated: number;
      errors: string[];
      error: null;
    }
  | { ok: false; error: string };

/**
 * Admin-only manual trigger for the Zoho inbound polling job. Same
 * code path as the daily cron — admin uses this when they expect a
 * receipt to have arrived since the last cron run.
 */
export async function pollZohoInboundNowAction(): Promise<PollNowState> {
  await requireAdmin();
  const summary = await processZohoInbound({ lookbackHours: 26 });
  revalidatePath("/admin/invoice-settings");
  return {
    ok: true,
    mode: summary.mode,
    messagesScanned: summary.messagesScanned,
    messagesProcessed: summary.messagesProcessed,
    invoicesCreated: summary.invoicesCreated,
    errors: summary.errors,
    error: null,
  };
}
