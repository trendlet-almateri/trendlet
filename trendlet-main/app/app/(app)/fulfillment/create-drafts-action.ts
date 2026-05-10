"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Currency } from "@/lib/types/database";

const KNOWN_CURRENCIES: Currency[] = ["SAR", "USD", "EUR", "GBP", "AED"];
function coerceCurrency(c: string | null | undefined, fallback: Currency): Currency {
  if (!c) return fallback;
  const upper = c.toUpperCase() as Currency;
  return (KNOWN_CURRENCIES as string[]).includes(upper) ? upper : fallback;
}

const schema = z.object({
  supplierInvoiceId: z.string().uuid(),
});

export type CreateDraftsState =
  | { ok: true; draftsCreated: number; error: null }
  | { ok: false; error: string };

/**
 * Phase 4f step C: turn the mapped supplier_invoice_items into
 * customer_invoices drafts in pending_review status. The admin's
 * invoice review queue already knows how to handle pending_review
 * rows from earlier phases.
 *
 * Per-line-item math:
 *   cost              = line_total
 *   markup_percent    = brand.markup_percent (snapshot)
 *   item_price        = cost * (1 + markup_percent/100)
 *   tax_percent       = settings.default_vat_percent
 *   tax_amount        = item_price * tax_percent / 100
 *   total             = item_price + tax_amount + shipment_fee
 *   total_currency    = sub_orders.currency (KSA customer always sees SAR)
 *   cost_currency     = supplier_invoices.currency or USD fallback
 *
 * Two line items mapped to the same sub-order are summed into one
 * customer_invoices row (avoids two invoices for one customer).
 *
 * Junction rows are inserted for any newly-mapped sub-orders that
 * weren't linked at upload time (4e linked one; 4f fans out).
 */
export async function createCustomerInvoiceDraftsAction(input: {
  supplierInvoiceId: string;
}): Promise<CreateDraftsState> {
  const user = await requireRole(["sourcing", "fulfiller", "admin"]);

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid id." };
  }

  const userScoped = createClient();

  // RLS gate.
  const { data: invoice, error: invErr } = await userScoped
    .from("supplier_invoices")
    .select("id, currency, ocr_model_used")
    .eq("id", parsed.data.supplierInvoiceId)
    .maybeSingle();
  if (invErr) return { ok: false, error: invErr.message };
  if (!invoice) {
    return { ok: false, error: "Receipt not found or not accessible." };
  }

  const sb = createServiceClient();

  // Pull all mapped items for this receipt.
  const { data: items, error: itemsErr } = await sb
    .from("supplier_invoice_items")
    .select(
      "id, description, quantity, unit_price, line_total, ai_confidence, mapped_sub_order_id",
    )
    .eq("supplier_invoice_id", invoice.id)
    .not("mapped_sub_order_id", "is", null);
  if (itemsErr) return { ok: false, error: itemsErr.message };
  if (!items || items.length === 0) {
    return { ok: false, error: "Map at least one line item to a sub-order first." };
  }

  // Group by sub_order so multiple items on the same customer fold into one invoice.
  const grouped = new Map<string, typeof items>();
  for (const it of items) {
    const k = it.mapped_sub_order_id as string;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(it);
  }

  // Read defaults: VAT %, shipping fee, current year for invoice number.
  const { data: settingsRows } = await sb
    .from("settings")
    .select("key, value")
    .in("key", ["default_vat_percent", "default_shipping_fee_sar"]);
  const settingsMap = new Map<string, unknown>();
  (settingsRows ?? []).forEach((r) => settingsMap.set(r.key, r.value));
  const taxPercent = numberOr(settingsMap.get("default_vat_percent"), 15);
  const shipmentFee = numberOr(settingsMap.get("default_shipping_fee_sar"), 25);

  // Resolve sub_order details for each group (need brand markup + currency).
  const subOrderIds = Array.from(grouped.keys());
  const { data: subOrders, error: subErr } = await sb
    .from("sub_orders")
    .select(
      "id, order_id, currency, brand:brands(markup_percent)",
    )
    .in("id", subOrderIds);
  if (subErr) return { ok: false, error: subErr.message };
  const subOrderById = new Map<
    string,
    { id: string; order_id: string; currency: string; markup: number }
  >();
  for (const so of subOrders ?? []) {
    const brand = (so as { brand: { markup_percent: number } | null }).brand;
    subOrderById.set(so.id, {
      id: so.id,
      order_id: so.order_id,
      currency: so.currency,
      markup: numberOr(brand?.markup_percent, 0),
    });
  }

  let drafts = 0;
  const year = new Date().getUTCFullYear();

  for (const [subOrderId, lineItems] of grouped) {
    const so = subOrderById.get(subOrderId);
    if (!so) continue; // Should not happen — RLS already gated.

    const cost = lineItems.reduce(
      (sum, it) => sum + numberOr(it.line_total, 0),
      0,
    );
    const markupPercent = so.markup;
    const itemPrice = round2(cost * (1 + markupPercent / 100));
    const taxAmount = round2((itemPrice * taxPercent) / 100);
    const total = round2(itemPrice + taxAmount + shipmentFee);

    const aiConfidence = pickWorstConfidence(
      lineItems.map((i) => i.ai_confidence as "high" | "medium" | "low" | null),
    );

    // Generate invoice number atomically.
    const { data: invoiceNumber, error: seqErr } = await sb.rpc(
      "next_invoice_sequence",
      { p_year: year },
    );
    if (seqErr || !invoiceNumber) {
      return {
        ok: false,
        error: `Failed to generate invoice number: ${seqErr?.message ?? "unknown"}`,
      };
    }

    const { error: insertErr } = await sb.from("customer_invoices").insert({
      invoice_number: invoiceNumber as unknown as string,
      order_id: so.order_id,
      status: "pending_review",
      cost,
      cost_currency: coerceCurrency(invoice.currency, "USD"),
      markup_percent: markupPercent,
      item_price: itemPrice,
      shipment_fee: shipmentFee,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      total,
      total_currency: coerceCurrency(so.currency, "SAR"),
      profit_amount: round2(itemPrice - cost),
      profit_percent: cost > 0 ? round2(((itemPrice - cost) / cost) * 100) : 0,
      ai_confidence: aiConfidence,
      ai_model_used: invoice.ocr_model_used,
      generated_by: user.id,
      generated_at: new Date().toISOString(),
      language: "en",
      supplier_invoice_id: invoice.id,
    });
    if (insertErr) {
      return { ok: false, error: `Failed to create draft: ${insertErr.message}` };
    }

    // Ensure junction row exists for this sub-order (4e only linked the
    // first one; 4f's fan-out goes here). Idempotent via PK conflict.
    await sb
      .from("sub_order_supplier_invoices")
      .insert({
        sub_order_id: so.id,
        supplier_invoice_id: invoice.id,
        linked_by: user.id,
      })
      .select()
      .maybeSingle();

    drafts += 1;
  }

  revalidatePath("/fulfillment");
  revalidatePath("/queue");
  revalidatePath("/invoices");

  return { ok: true, draftsCreated: drafts, error: null };
}

function numberOr(v: unknown, fallback: number): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pickWorstConfidence(
  confidences: ("high" | "medium" | "low" | null)[],
): "high" | "medium" | "low" {
  if (confidences.includes("low")) return "low";
  if (confidences.includes("medium")) return "medium";
  return "high";
}
