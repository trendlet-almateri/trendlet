/**
 * Preview the customer-facing PDF before admin approves the invoice.
 *
 * GET /api/invoices/:id/preview
 *
 * Renders the PDF in-memory from the current invoice state — no storage
 * write, no status flip. Lets admins eyeball the customer-facing artifact
 * before committing. Mirrors the data-shape used by generateAndStoreInvoicePdf
 * so the preview matches exactly what gets stored on Approve.
 *
 * Auth: admin only. Invoice must exist (any status).
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { renderCustomerInvoicePdf, type InvoicePdfData } from "@/lib/pdf/customer-invoice-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  await requireAdmin();
  const sb = createServiceClient();

  const { data: inv, error: fetchErr } = await sb
    .from("customer_invoices")
    .select(`
      invoice_number, generated_at, language, item_price, discount_amount,
      shipment_fee, tax_amount, tax_percent, total, total_currency,
      order:orders (
        shopify_order_number,
        customer:customers ( first_name, last_name, email, default_address ),
        sub_orders ( product_title, sku, quantity )
      ),
      supplier_invoice:supplier_invoices ( barcode )
    `)
    .eq("id", params.id)
    .maybeSingle();

  if (fetchErr || !inv) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Prefer admin-edited line items.
  const { data: itemRows } = await sb
    .from("customer_invoice_items")
    .select("title, sku, quantity, unit_price, line_total")
    .eq("customer_invoice_id", params.id)
    .order("position", { ascending: true });

  type Addr = { address1?: string | null; city?: string | null; country?: string | null } | null;
  const order = (inv as { order: unknown }).order as {
    shopify_order_number: string | null;
    customer: {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      default_address: Addr;
    } | null;
    sub_orders: { product_title: string | null; sku: string | null; quantity: number | null }[] | null;
  } | null;
  const supplierInv = (inv as { supplier_invoice: unknown }).supplier_invoice as {
    barcode: string | null;
  } | null;

  const customerName = order?.customer
    ? [order.customer.first_name, order.customer.last_name].filter(Boolean).join(" ").trim() || "Customer"
    : "Customer";
  const addr = order?.customer?.default_address ?? null;

  const data: InvoicePdfData = {
    invoice_number: (inv as { invoice_number: string }).invoice_number,
    generated_at:
      (inv as { generated_at: string | null }).generated_at ?? new Date().toISOString(),
    language:
      ((inv as { language: InvoicePdfData["language"] }).language) ?? "en",
    customer: {
      name: customerName,
      email: order?.customer?.email ?? null,
      address: addr
        ? { line1: addr.address1, city: addr.city, country: addr.country }
        : null,
    },
    order: { shopify_order_number: order?.shopify_order_number ?? null },
    items:
      itemRows && itemRows.length > 0
        ? (itemRows as {
            title: string;
            sku: string | null;
            quantity: number;
            unit_price: number | null;
            line_total: number | null;
          }[]).map((r) => ({
            title: r.title,
            sku: r.sku,
            quantity: r.quantity,
            unit_price: r.unit_price != null ? Number(r.unit_price) : undefined,
            line_total: r.line_total != null ? Number(r.line_total) : undefined,
          }))
        : (order?.sub_orders ?? []).map((s) => ({
            title: s.product_title ?? "Item",
            sku: s.sku,
            quantity: s.quantity ?? 1,
          })),
    totals: {
      item_price: Number((inv as { item_price: number }).item_price),
      discount_amount: Number((inv as { discount_amount?: number }).discount_amount ?? 0),
      shipment_fee: Number((inv as { shipment_fee: number }).shipment_fee),
      tax_amount: Number((inv as { tax_amount: number }).tax_amount),
      tax_percent: Number((inv as { tax_percent: number }).tax_percent),
      total: Number((inv as { total: number }).total),
      currency: (inv as { total_currency: string }).total_currency,
    },
    barcode: supplierInv?.barcode ?? null,
  };

  // Wrap render in try/catch so production iframes don't show a generic
  // 500 — we surface the actual error message + stack to make Vercel-only
  // runtime issues (font path, asset bundling, fontkit failures) debuggable.
  try {
    const buffer = await renderCustomerInvoicePdf(data);
    // Coerce to Uint8Array for tighter NextResponse body compatibility.
    const body = new Uint8Array(buffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${data.invoice_number}-preview.pdf"`,
        // No caching — preview reflects current edits.
        "Cache-Control": "no-store, must-revalidate",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown render error";
    const stack = err instanceof Error ? err.stack ?? "" : "";
    console.error("[invoice-preview] render failed:", msg, stack);
    return NextResponse.json(
      { error: "PDF render failed", message: msg, stack: stack.split("\n").slice(0, 6) },
      { status: 500 },
    );
  }
}
