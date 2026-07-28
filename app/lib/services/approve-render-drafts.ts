/**
 * Backfill: approve + render PDF for existing DRAFT customer invoices (the
 * bulk-generated batch). Processes a limited number per call so a single
 * request stays under the serverless timeout — call repeatedly until
 * `remaining` is 0.
 *
 * Reuses the same PDF data-shape as the auto-create path. Only touches drafts
 * with no PDF yet; safe to re-run.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { renderTaxInvoicePdf, type TaxInvoicePdfData } from "@/lib/pdf/tax-invoice-pdf";
import { uploadCustomerInvoicePdf } from "@/lib/storage/customer-invoices";
import { gatewayLabel } from "@/lib/services/tax-invoice-pdf-data";

type Row = {
  id: string;
  invoice_number: string;
  total: number;
  total_currency: string;
  item_price: number;
  discount_amount: number | null;
};

export async function approveRenderDrafts(batchSize = 20): Promise<{
  processed: number;
  errors: number;
  remaining: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;

  const { data: drafts } = await sb
    .from("customer_invoices")
    .select("id, invoice_number, total, total_currency, item_price, discount_amount")
    .eq("status", "draft")
    .limit(batchSize);

  let processed = 0, errors = 0;
  for (const inv of (drafts ?? []) as Row[]) {
    try {
      // Line item + sub-order number + order/customer for the PDF.
      const { data: items } = await sb
        .from("customer_invoice_items")
        .select("title, sku, quantity, unit_price, line_total")
        .eq("customer_invoice_id", inv.id)
        .order("position", { ascending: true });
      const { data: junction } = await sb
        .from("customer_invoice_sub_orders")
        .select("sub_order:sub_orders ( sub_order_number, order:orders ( shopify_order_number, raw_payload, customer:customers ( first_name, last_name, phone, default_address ) ) )")
        .eq("customer_invoice_id", inv.id);

      const j = junction?.[0]?.sub_order ?? null;
      const order = j?.order ?? null;
      const cust = order?.customer ?? null;
      const addr = cust?.default_address ?? null;
      const name = cust ? [cust.first_name, cust.last_name].filter(Boolean).join(" ").trim() || "Customer" : "Customer";
      const paymentMethod = gatewayLabel(order?.raw_payload?.payment_gateway_names?.[0] ?? null);
      const now = new Date().toISOString();
      const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const lineItems = (items ?? []).map((r: { title: string; sku: string | null; quantity: number; unit_price: number | null; line_total: number | null }) => {
        const qty = r.quantity ?? 1;
        const unit = r.unit_price != null ? Number(r.unit_price) : 0;
        return { title: r.title, variant_title: r.sku ? `SKU ${r.sku}` : null, quantity: qty, unit_price: unit, line_total: r.line_total != null ? Number(r.line_total) : unit * qty };
      });

      const data: TaxInvoicePdfData = {
        invoice_number: inv.invoice_number,
        issue_date: now,
        due_date: due,
        order: { shopify_order_number: order?.shopify_order_number ?? null, sub_order_number: j?.sub_order_number ?? null },
        customer: { name, phone: cust?.phone ?? addr?.phone ?? null, city: addr?.city ?? null, payment_method: paymentMethod },
        line_items: lineItems,
        totals: { subtotal: Number(inv.item_price), discount: Number(inv.discount_amount ?? 0), grand_total: Number(inv.total), currency: inv.total_currency },
        payment: { paid: false, method: paymentMethod, paid_at: null },
      };

      const pdf = await renderTaxInvoicePdf(data);
      const path = await uploadCustomerInvoicePdf(inv.invoice_number, pdf);
      await sb.from("customer_invoices").update({ status: "approved", reviewed_at: now, pdf_storage_path: path }).eq("id", inv.id);
      processed++;
    } catch (e) {
      console.error("[approveRenderDrafts]", inv.invoice_number, e);
      errors++;
    }
  }

  const { count: remaining } = await sb
    .from("customer_invoices")
    .select("*", { count: "exact", head: true })
    .eq("status", "draft");

  return { processed, errors, remaining: remaining ?? 0 };
}
