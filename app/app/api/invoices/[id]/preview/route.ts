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
import { renderTaxInvoicePdf, type TaxInvoicePdfData } from "@/lib/pdf/tax-invoice-pdf";
import { gatewayLabel } from "@/lib/services/tax-invoice-pdf-data";

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
        shopify_order_number, raw_payload,
        customer:customers ( first_name, last_name, email, phone, default_address ),
        sub_orders ( product_title, sku, quantity )
      )
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

  // Per-sub-order invoices link exactly one sub-order — show its number
  // (#1514-01) instead of the order number. Falls back to order number
  // for legacy multi-sub-order invoices.
  const { data: junction } = await sb
    .from("customer_invoice_sub_orders")
    .select("sub_order:sub_orders ( sub_order_number )")
    .eq("customer_invoice_id", params.id);
  const subOrderNumber =
    junction && junction.length === 1
      ? ((junction[0] as { sub_order: { sub_order_number: string } | null }).sub_order?.sub_order_number ?? null)
      : null;

  type Addr = {
    address1?: string | null;
    city?: string | null;
    country?: string | null;
    phone?: string | null;
  } | null;
  const order = (inv as { order: unknown }).order as {
    shopify_order_number: string | null;
    raw_payload: { payment_gateway_names?: string[] | null } | null;
    customer: {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      default_address: Addr;
    } | null;
    sub_orders: { product_title: string | null; sku: string | null; quantity: number | null }[] | null;
  } | null;

  // Payment method from the Shopify gateway (same source as the tax invoice).
  const paymentMethod = gatewayLabel(order?.raw_payload?.payment_gateway_names?.[0] ?? null);

  const customerName = order?.customer
    ? [order.customer.first_name, order.customer.last_name].filter(Boolean).join(" ").trim() || "Customer"
    : "Customer";
  const addr = order?.customer?.default_address ?? null;

  // Same shared invoice template as the tax invoice (one fixed template).
  // Payment method comes from the Shopify gateway; paid stays false here since
  // this is a customer (not tax) invoice and we don't assert settlement.
  const lineItems =
    itemRows && itemRows.length > 0
      ? (itemRows as {
          title: string;
          sku: string | null;
          quantity: number;
          unit_price: number | null;
          line_total: number | null;
        }[]).map((r) => {
          const qty = r.quantity ?? 1;
          const unit = r.unit_price != null ? Number(r.unit_price) : 0;
          return {
            title: r.title,
            variant_title: r.sku ? `SKU ${r.sku}` : null,
            quantity: qty,
            unit_price: unit,
            line_total: r.line_total != null ? Number(r.line_total) : unit * qty,
          };
        })
      : (order?.sub_orders ?? []).map((s) => ({
          title: s.product_title ?? "Item",
          variant_title: s.sku ? `SKU ${s.sku}` : null,
          quantity: s.quantity ?? 1,
          unit_price: 0,
          line_total: 0,
        }));

  const issueDate =
    (inv as { generated_at: string | null }).generated_at ?? new Date().toISOString();
  const dueDate = new Date(new Date(issueDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const data: TaxInvoicePdfData = {
    invoice_number: (inv as { invoice_number: string }).invoice_number,
    issue_date: issueDate,
    due_date: dueDate,
    order: {
      shopify_order_number: order?.shopify_order_number ?? null,
      sub_order_number: subOrderNumber,
    },
    customer: {
      name: customerName,
      phone: order?.customer?.phone ?? addr?.phone ?? null,
      city: addr?.city ?? null,
      payment_method: paymentMethod,
    },
    line_items: lineItems,
    totals: {
      subtotal: Number((inv as { item_price: number }).item_price),
      discount: Number((inv as { discount_amount?: number }).discount_amount ?? 0),
      grand_total: Number((inv as { total: number }).total),
      currency: (inv as { total_currency: string }).total_currency,
    },
    payment: { paid: false, method: paymentMethod, paid_at: null },
  };

  // Wrap render in try/catch so production iframes don't show a generic
  // 500 — we surface the actual error message + stack to make Vercel-only
  // runtime issues (font path, asset bundling, fontkit failures) debuggable.
  try {
    const buffer = await renderTaxInvoicePdf(data);
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
