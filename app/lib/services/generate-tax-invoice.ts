/**
 * Auto-generate a tax invoice for a newly ingested order.
 *
 * Called fire-and-forget from the Shopify orders/create webhook. Mirrors the
 * manual /tax-invoices/new flow, but only ISSUES when pricing resolves
 * unambiguously. Otherwise it leaves a 'needs_pricing' draft an admin finishes
 * by hand (no fees, no PDF) — we never guess a fee on a tax document.
 *
 * "Unambiguous" = findPricingRule returns a rule: the order's brand resolves to
 * a SINGLE pricing brand (no Boutique/Outlet choice) AND the category matches.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { findPricingRule } from "@/lib/queries/tax-pricing";
import { renderTaxInvoicePdf } from "@/lib/pdf/tax-invoice-pdf";
import { uploadTaxInvoicePdf } from "@/lib/storage/tax-invoices";

type GenResult =
  | { action: "issued"; invoiceId: string; invoiceNumber: string }
  | { action: "needs_pricing"; invoiceId: string; invoiceNumber: string }
  | { action: "skipped"; reason: string };

export async function generateTaxInvoiceForOrder(orderId: string): Promise<GenResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;

  // One tax invoice per order — a duplicate webhook must not create a second.
  const { data: existing } = await sb
    .from("tax_invoices")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existing) return { action: "skipped", reason: "already has a tax invoice" };

  // Order + its first sub-order line (brand + product_type) drive the match.
  // This runs immediately after the order/sub_orders were inserted in the same
  // webhook request. This Supabase instance has a read-after-write lag, so the
  // freshly-inserted rows may not be visible on the first read — retry a few
  // times with a short backoff until the order AND at least one sub_order show
  // up, rather than silently skipping.
  let order: {
    id: string;
    shopify_order_number: string;
    sub_orders: { product_type: string | null; brand: { name: string } | null }[];
  } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await sb
      .from("orders")
      .select(`
        id, shopify_order_number,
        sub_orders ( product_type, brand:brands ( name ) )
      `)
      .eq("id", orderId)
      .maybeSingle();
    order = data ?? null;
    if (order && (order.sub_orders?.length ?? 0) > 0) break;
    await new Promise((r) => setTimeout(r, 400)); // ~0.4s backoff, max ~2s total
  }
  if (!order) return { action: "skipped", reason: "order not found (after retries)" };
  if ((order.sub_orders?.length ?? 0) === 0) {
    return { action: "skipped", reason: "no sub_orders visible (after retries)" };
  }

  const firstSub = (order.sub_orders ?? [])[0] ?? null;
  const brandName: string | null = firstSub?.brand?.name ?? null;
  const productType: string | null = firstSub?.product_type ?? null;

  const matched = await findPricingRule(brandName, productType);

  // Reserve the invoice number atomically (shared with the manual flow).
  const { data: numData, error: numErr } = await sb.rpc("next_tax_invoice_sequence", {
    p_year: new Date().getUTCFullYear(),
  });
  if (numErr || !numData) {
    return { action: "skipped", reason: numErr?.message ?? "no invoice number" };
  }
  const invoiceNumber = numData as string;

  // ── No clean match → needs_pricing draft for manual completion ──────────
  if (!matched) {
    const { data: draft, error: draftErr } = await sb
      .from("tax_invoices")
      .insert({
        invoice_number: invoiceNumber,
        order_id: orderId,
        status: "needs_pricing",
        brand_name: brandName,
        category_ar: productType, // record what the order said, for the hint
        currency: "SAR",
      })
      .select("id")
      .single();
    if (draftErr || !draft) {
      return { action: "skipped", reason: draftErr?.message ?? "draft insert failed" };
    }
    return { action: "needs_pricing", invoiceId: draft.id, invoiceNumber };
  }

  // ── Clean match → issue the invoice + render the PDF ────────────────────
  const fees = {
    service_fee_net: matched.service_fee_net,
    service_fee_vat: matched.service_fee_vat,
    service_fee_with_vat: matched.service_fee_with_vat,
    shipping_customs_fee: matched.shipping_customs_fee,
  };
  const totalFee = fees.service_fee_with_vat + fees.shipping_customs_fee;

  const { data: inv, error: invErr } = await sb
    .from("tax_invoices")
    .insert({
      invoice_number: invoiceNumber,
      order_id: orderId,
      status: "issued",
      brand_name: matched.brand_name,
      category_ar: matched.category_ar,
      service_fee_net: fees.service_fee_net,
      service_fee_vat: fees.service_fee_vat,
      service_fee_with_vat: fees.service_fee_with_vat,
      shipping_customs_fee: fees.shipping_customs_fee,
      total_fee: totalFee,
      currency: "SAR",
      pricing_rule_id: matched.id,
      generated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (invErr || !inv) {
    return { action: "skipped", reason: invErr?.message ?? "invoice insert failed" };
  }

  try {
    const pdf = await renderTaxInvoicePdf({
      invoice_number: invoiceNumber,
      generated_at: new Date().toISOString(),
      order: { shopify_order_number: order.shopify_order_number ?? null },
      brand_name: matched.brand_name,
      category_ar: matched.category_ar,
      fees: { ...fees, total_fee: totalFee, currency: "SAR" },
    });
    const path = await uploadTaxInvoicePdf(invoiceNumber, pdf);
    await sb.from("tax_invoices").update({ pdf_storage_path: path }).eq("id", inv.id);
  } catch (e) {
    // Invoice row stands; PDF can be regenerated. Don't fail the webhook.
    console.error("[generateTaxInvoiceForOrder] pdf", e);
  }

  return { action: "issued", invoiceId: inv.id, invoiceNumber };
}
