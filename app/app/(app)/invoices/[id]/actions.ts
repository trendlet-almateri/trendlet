"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createServiceClient } from "@/lib/supabase/server";
import { renderCustomerInvoicePdf, type InvoicePdfData } from "@/lib/pdf/customer-invoice-pdf";
import { uploadCustomerInvoicePdf } from "@/lib/storage/customer-invoices";

export type ActionState = { ok: boolean; error: string | null };

const idSchema = z.string().uuid("invalid invoice id");

const rejectSchema = z.object({
  id: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters.")
    .max(500, "Reason is too long."),
});

/**
 * Approve a pending_review invoice + generate its customer-facing PDF.
 *
 * Flow:
 *   1. Flip status pending_review → approved (idempotency-guarded).
 *   2. Render the PDF (joined data: order, customer, sub_orders, supplier
 *      barcode), upload to Storage, write pdf_storage_path on the row.
 *
 * If step 2 fails, the invoice stays approved and the admin can retry
 * via regenerateInvoicePdfAction. This keeps the human decision (approval)
 * decoupled from the artifact (PDF).
 */
export async function approveInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: id.error.issues[0]?.message ?? "Invalid id." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const sb = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("customer_invoices") as any)
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      // Clear any prior rejection reason on re-approval.
      rejection_reason: null,
    })
    .eq("id", id.data)
    .eq("status", "pending_review"); // Idempotency guard

  if (error) return { ok: false, error: error.message };

  // Generate the PDF. Failure here doesn't roll back the approval —
  // status reflects the human decision; PDF is a regenerable artifact.
  const pdfResult = await generateAndStoreInvoicePdf(id.data);

  revalidatePath(`/invoices/${id.data}`);
  revalidatePath("/invoices");

  if (!pdfResult.ok) {
    return {
      ok: false,
      error: `Approved, but PDF generation failed: ${pdfResult.error}. Use "Regenerate PDF" to retry.`,
    };
  }
  return { ok: true, error: null };
}

/**
 * Regenerate the PDF for an already-approved invoice. Used when the
 * initial render in approveInvoiceAction failed, or when the supplier
 * barcode was added after approval.
 */
export async function regenerateInvoicePdfAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: id.error.issues[0]?.message ?? "Invalid id." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const result = await generateAndStoreInvoicePdf(id.data);
  revalidatePath(`/invoices/${id.data}`);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, error: null };
}

/**
 * Reject a pending_review invoice with a reason.
 * Reason is required (3-500 chars).
 */
export async function rejectInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = rejectSchema.safeParse({
    id: formData.get("id"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const sb = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("customer_invoices") as any)
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: parsed.data.reason,
    })
    .eq("id", parsed.data.id)
    .eq("status", "pending_review");

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/invoices/${parsed.data.id}`);
  revalidatePath("/invoices");
  return { ok: true, error: null };
}

/**
 * Re-open a rejected invoice for another review pass. Sourcing fixes the
 * underlying inputs separately; this just moves the status back so admins
 * see it in the queue again.
 */
export async function reopenInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: id.error.issues[0]?.message ?? "Invalid id." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const sb = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("customer_invoices") as any)
    .update({
      status: "pending_review",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      // Keep rejection_reason on the row as history for the audit trail.
    })
    .eq("id", id.data)
    .eq("status", "rejected");

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/invoices/${id.data}`);
  revalidatePath("/invoices");
  return { ok: true, error: null };
}

/**
 * Mark an approved invoice as sent. PLACEHOLDER — does not actually email
 * the customer yet. Sets sent_at + sent_to_email so the row reads as
 * "delivered" in the UI. Real Zoho Mail integration arrives in Phase 3.
 */
export async function markSentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: id.error.issues[0]?.message ?? "Invalid id." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const sb = createServiceClient();

  // Look up the customer email from the linked order so we record where it
  // *would* have gone. Required column on customer_invoices is sent_to_email.
  const { data: invRaw } = await sb
    .from("customer_invoices")
    .select("order:orders ( customer:customers ( email ) )")
    .eq("id", id.data)
    .maybeSingle();
  const customerEmail =
    (invRaw as { order?: { customer?: { email?: string | null } | null } | null } | null)
      ?.order?.customer?.email ?? null;

  if (!customerEmail) {
    return {
      ok: false,
      error: "Customer has no email address on file. Add one before sending.",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("customer_invoices") as any)
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_to_email: customerEmail,
    })
    .eq("id", id.data)
    .eq("status", "approved");

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/invoices/${id.data}`);
  revalidatePath("/invoices");
  return { ok: true, error: null };
}

/* ── PDF helper ──────────────────────────────────────────────────────── */

/**
 * Build joined invoice data, render the PDF, upload to storage, and
 * write `pdf_storage_path` back on the row. Service-role only.
 *
 * Returns ok=false with a human-readable error message on any step's
 * failure — the calling action decides how to surface it.
 */
async function generateAndStoreInvoicePdf(
  invoiceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sb = createServiceClient();

    // Fetch the invoice + everything we need to render in one round-trip.
    // The supplier_invoices join is left/optional — many invoices won't
    // be linked to one yet (sourcing UI ships in Phase 4).
    const { data: inv, error: fetchErr } = await sb
      .from("customer_invoices")
      .select(`
        invoice_number, generated_at, language, item_price, shipment_fee,
        tax_amount, tax_percent, total, total_currency,
        order:orders (
          shopify_order_number,
          customer:customers ( first_name, last_name, email, default_address ),
          sub_orders ( shopify_line_item_title, shopify_sku, quantity )
        ),
        supplier_invoice:supplier_invoices ( barcode )
      `)
      .eq("id", invoiceId)
      .maybeSingle();

    if (fetchErr) return { ok: false, error: fetchErr.message };
    if (!inv) return { ok: false, error: "Invoice not found." };

    type Addr = { address1?: string | null; city?: string | null; country?: string | null } | null;
    const order = (inv as { order: unknown }).order as {
      shopify_order_number: string | null;
      customer: {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
        default_address: Addr;
      } | null;
      sub_orders: { shopify_line_item_title: string | null; shopify_sku: string | null; quantity: number | null }[] | null;
    } | null;
    const supplierInv = (inv as { supplier_invoice: unknown }).supplier_invoice as {
      barcode: string | null;
    } | null;

    const customerName = order?.customer
      ? [order.customer.first_name, order.customer.last_name].filter(Boolean).join(" ").trim() || "Customer"
      : "Customer";
    const addr = order?.customer?.default_address ?? null;

    const data: InvoicePdfData = {
      invoice_number: inv.invoice_number,
      generated_at: inv.generated_at ?? new Date().toISOString(),
      language: (inv.language as InvoicePdfData["language"]) ?? "en",
      customer: {
        name: customerName,
        email: order?.customer?.email ?? null,
        address: addr
          ? { line1: addr.address1, city: addr.city, country: addr.country }
          : null,
      },
      order: { shopify_order_number: order?.shopify_order_number ?? null },
      items: (order?.sub_orders ?? []).map((s) => ({
        title: s.shopify_line_item_title ?? "Item",
        sku: s.shopify_sku,
        quantity: s.quantity ?? 1,
      })),
      totals: {
        item_price: Number(inv.item_price),
        shipment_fee: Number(inv.shipment_fee),
        tax_amount: Number(inv.tax_amount),
        tax_percent: Number(inv.tax_percent),
        total: Number(inv.total),
        currency: inv.total_currency,
      },
      barcode: supplierInv?.barcode ?? null,
    };

    const buffer = await renderCustomerInvoicePdf(data);
    const path = await uploadCustomerInvoicePdf(inv.invoice_number, buffer);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateErr } = await (sb.from("customer_invoices") as any)
      .update({ pdf_storage_path: path })
      .eq("id", invoiceId);
    if (updateErr) return { ok: false, error: updateErr.message };

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown PDF render error.";
    return { ok: false, error: msg };
  }
}
