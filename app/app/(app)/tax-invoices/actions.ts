"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { regenerateAllTaxInvoicePdfs } from "@/lib/services/regenerate-tax-invoice-pdf";

/**
 * Re-render every tax invoice's PDF onto the current breakdown calc.
 * Admin-only (session auth) — no CRON_SECRET, runs in-app. No row deleted.
 */
export async function regenerateAllTaxInvoicesAction(): Promise<{
  ok: boolean;
  done: number;
  failed: number;
  error?: string;
}> {
  await requireRole(["admin"]);
  try {
    const results = await regenerateAllTaxInvoicePdfs();
    const fails = results.filter((r) => !r.ok);
    revalidatePath("/tax-invoices");
    // Surface the first failure's reason so a 0/N result is debuggable from the UI.
    const firstErr = fails[0]?.error;
    return {
      ok: true,
      done: results.length - fails.length,
      failed: fails.length,
      error: firstErr ? `e.g. ${firstErr}` : undefined,
    };
  } catch (e) {
    return { ok: false, done: 0, failed: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
