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
    const failed = results.filter((r) => !r.ok).length;
    revalidatePath("/tax-invoices");
    return { ok: true, done: results.length - failed, failed };
  } catch (e) {
    return { ok: false, done: 0, failed: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
