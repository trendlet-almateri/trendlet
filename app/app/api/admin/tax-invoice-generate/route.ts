/**
 * POST /api/admin/tax-invoice-generate
 *   { order_id: "<uuid>" }        → (re)run generateTaxInvoiceForOrder for one order
 *   { regenerate: "<invoiceId>" } → re-render ONE existing invoice's PDF (new breakdown calc)
 *   { regenerate: "all" }         → re-render every existing invoice's PDF
 *
 * The `regenerate` modes only re-render the PDF (which is where the per-item
 * 70-SAR breakdown lives) and upsert it in storage — no row is changed or
 * deleted. Used to bring old invoices onto the new tax-generation calc.
 *
 * Auth: Bearer CRON_SECRET (same token the GitHub poll uses).
 */
import { NextResponse } from "next/server";
import { generateTaxInvoiceForOrder } from "@/lib/services/generate-tax-invoice";
import { regenerateTaxInvoicePdf, regenerateAllTaxInvoicePdfs } from "@/lib/services/regenerate-tax-invoice-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { order_id?: string; regenerate?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    /* ignore */
  }

  try {
    if (body.regenerate === "all") {
      const results = await regenerateAllTaxInvoicePdfs();
      return NextResponse.json({ ok: true, results });
    }
    if (body.regenerate) {
      const result = await regenerateTaxInvoicePdf(body.regenerate);
      return NextResponse.json({ ok: true, result });
    }
    if (body.order_id) {
      const result = await generateTaxInvoiceForOrder(body.order_id);
      return NextResponse.json({ ok: true, result });
    }
    return NextResponse.json({ error: "order_id or regenerate required" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack?.slice(0, 1200) : undefined,
      },
      { status: 500 },
    );
  }
}
