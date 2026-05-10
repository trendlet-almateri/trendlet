"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { extractSupplierInvoice } from "@/lib/integrations/openrouter-extract";
import type { Currency } from "@/lib/types/database";

const KNOWN_CURRENCIES: Currency[] = ["SAR", "USD", "EUR", "GBP", "AED"];
function coerceCurrency(c: string | null): Currency | null {
  if (!c) return null;
  const upper = c.toUpperCase() as Currency;
  return (KNOWN_CURRENCIES as string[]).includes(upper) ? upper : null;
}

const schema = z.object({
  supplierInvoiceId: z.string().uuid(),
});

export type ExtractState =
  | { ok: true; itemsExtracted: number; mode: "live" | "mock"; error: null }
  | { ok: false; error: string };

/**
 * Phase 4f step A: pull a supplier-receipt PDF from storage, run AI
 * extraction (or mock-fallback), and persist the line items into
 * supplier_invoice_items. The mapping UI calls this on first open.
 *
 * Idempotency: if items already exist for this supplier_invoice_id we
 * return early — re-extracting would create duplicates. Admins who
 * want a re-run should delete supplier_invoice_items rows first.
 */
export async function extractSupplierInvoiceAction(input: {
  supplierInvoiceId: string;
}): Promise<ExtractState> {
  const user = await requireRole(["sourcing", "fulfiller", "admin"]);

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid id." };
  }

  const userScoped = createClient();

  // Ownership check: the user must be able to see this supplier_invoice
  // through RLS (they uploaded it, or they're admin).
  const { data: invoice, error: invErr } = await userScoped
    .from("supplier_invoices")
    .select("id, storage_path, original_filename, ocr_state")
    .eq("id", parsed.data.supplierInvoiceId)
    .maybeSingle();

  if (invErr) return { ok: false, error: invErr.message };
  if (!invoice) {
    return { ok: false, error: "Receipt not found or not accessible." };
  }

  const sb = createServiceClient();

  // If items already exist, treat this as a no-op success.
  const { count: existingCount, error: countErr } = await sb
    .from("supplier_invoice_items")
    .select("id", { count: "exact", head: true })
    .eq("supplier_invoice_id", invoice.id);
  if (countErr) return { ok: false, error: countErr.message };
  if ((existingCount ?? 0) > 0) {
    return { ok: true, itemsExtracted: existingCount ?? 0, mode: "mock", error: null };
  }

  // Read the chosen model from settings.
  const { data: settingsRow, error: setErr } = await sb
    .from("settings")
    .select("value")
    .eq("key", "ocr_model_id")
    .maybeSingle();
  if (setErr) return { ok: false, error: setErr.message };
  const modelId =
    typeof settingsRow?.value === "string" ? settingsRow.value : "gpt-4o";

  // Mark extracting.
  await sb
    .from("supplier_invoices")
    .update({ ocr_state: "extracting" })
    .eq("id", invoice.id);

  // Pull the PDF from storage.
  const { data: blob, error: dlErr } = await sb.storage
    .from("supplier-invoices")
    .download(invoice.storage_path);
  if (dlErr || !blob) {
    await sb
      .from("supplier_invoices")
      .update({ ocr_state: "failed" })
      .eq("id", invoice.id);
    return { ok: false, error: `Failed to read PDF: ${dlErr?.message ?? "unknown"}` };
  }
  const pdfBuffer = Buffer.from(await blob.arrayBuffer());

  const extraction = await extractSupplierInvoice({
    pdf: pdfBuffer,
    modelId,
    filename: invoice.original_filename ?? "receipt.pdf",
  });

  if (extraction.error) {
    await sb
      .from("supplier_invoices")
      .update({ ocr_state: "failed" })
      .eq("id", invoice.id);
    return { ok: false, error: extraction.error };
  }

  // Persist invoice-level fields + items.
  await sb
    .from("supplier_invoices")
    .update({
      supplier_name: extraction.data.supplier_name,
      invoice_date: extraction.data.invoice_date,
      invoice_total: extraction.data.invoice_total,
      currency: coerceCurrency(extraction.data.currency),
      barcode: extraction.data.barcode,
      ocr_state: "extracted",
      ocr_model_used: extraction.model_used,
      ocr_extracted_at: new Date().toISOString(),
      ocr_raw_response: { mode: extraction.mode },
    })
    .eq("id", invoice.id);

  if (extraction.data.items.length > 0) {
    const rows = extraction.data.items.map((it) => ({
      supplier_invoice_id: invoice.id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      line_total: it.line_total,
      ai_confidence: it.ai_confidence,
      ai_match_score: it.ai_match_score,
      ai_reasoning: it.ai_reasoning,
    }));
    const { error: insertErr } = await sb.from("supplier_invoice_items").insert(rows);
    if (insertErr) {
      return { ok: false, error: `Failed to save items: ${insertErr.message}` };
    }
  }

  revalidatePath("/fulfillment");
  revalidatePath("/queue");

  // user.id captured for symmetry with the upload action; not yet
  // logged here but useful when activity_log is wired up.
  void user;

  return {
    ok: true,
    itemsExtracted: extraction.data.items.length,
    mode: extraction.mode,
    error: null,
  };
}
