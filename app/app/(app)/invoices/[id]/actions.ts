"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createServiceClient } from "@/lib/supabase/server";
import { renderCustomerInvoicePdf, type InvoicePdfData } from "@/lib/pdf/customer-invoice-pdf";
import {
  uploadCustomerInvoicePdf,
  downloadCustomerInvoicePdf,
} from "@/lib/storage/customer-invoices";
import {
  sendCustomerInvoiceEmail,
  isZohoConfigured,
} from "@/lib/integrations/zoho-mail";

export type ActionState = { ok: boolean; error: string | null };

const idSchema = z.string().uuid("invalid invoice id");

/* ── update (edit) ──────────────────────────────────────────────────── */

const CURRENCY = z.enum(["SAR", "USD", "EUR", "GBP", "AED"]);
const lineItemUpdateSchema = z.object({
  title: z.string().trim().min(1),
  sku: z.string().trim().nullable().optional(),
  quantity: z.coerce.number().int().positive(),
  unit_price: z.coerce.number().nonnegative(),
  sub_order_id: z.string().uuid().nullable().optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  cost: z.coerce.number().nonnegative(),
  cost_currency: CURRENCY,
  markup_percent: z.coerce.number().nonnegative(),
  shipment_fee: z.coerce.number().nonnegative().default(0),
  tax_percent: z.coerce.number().nonnegative().default(0),
  total_currency: CURRENCY,
  language: z.enum(["en", "ar", "bilingual"]).default("en"),
  items: z.array(lineItemUpdateSchema).min(1),
  submit_for_review: z.coerce.boolean().default(false),
});

/**
 * Edit a non-approved invoice. Replaces line items wholesale (delete + insert).
 *
 * Status guard: only draft / pending_review / rejected can be edited.
 * Approved + sent are locked (the PDF and any sent email are immutable).
 *
 * If submit_for_review=true and current status is draft|rejected, we flip
 * status to pending_review at the same time.
 */
export async function updateInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const itemsRaw = formData.get("items_json");
  let parsedItems: unknown = [];
  try {
    parsedItems = typeof itemsRaw === "string" ? JSON.parse(itemsRaw) : [];
  } catch {
    return { ok: false, error: "Invalid line items payload." };
  }

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    cost: formData.get("cost"),
    cost_currency: formData.get("cost_currency"),
    markup_percent: formData.get("markup_percent"),
    shipment_fee: formData.get("shipment_fee") || 0,
    tax_percent: formData.get("tax_percent") || 0,
    total_currency: formData.get("total_currency"),
    language: formData.get("language") || "en",
    items: parsedItems,
    submit_for_review:
      formData.get("submit_for_review") === "on" || formData.get("submit_for_review") === "true",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const sb = createServiceClient();

  // Status guard.
  const { data: cur } = await sb
    .from("customer_invoices")
    .select("status")
    .eq("id", v.id)
    .maybeSingle();
  if (!cur) return { ok: false, error: "Invoice not found." };
  const status = (cur as { status: string }).status;
  if (status !== "draft" && status !== "pending_review" && status !== "rejected") {
    return { ok: false, error: `Can't edit a ${status} invoice.` };
  }

  // Recompute totals from the line items.
  const itemPrice = v.items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
  const taxAmount = (itemPrice + v.shipment_fee) * (v.tax_percent / 100);
  const total = itemPrice + v.shipment_fee + taxAmount;
  const profitAmount = total - v.cost - v.shipment_fee - taxAmount;
  const profitPercent = v.cost > 0 ? (profitAmount / v.cost) * 100 : null;

  const newStatus =
    v.submit_for_review && (status === "draft" || status === "rejected")
      ? "pending_review"
      : status;

  // Patch header.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (sb.from("customer_invoices") as any)
    .update({
      cost: v.cost,
      cost_currency: v.cost_currency,
      markup_percent: v.markup_percent,
      item_price: itemPrice,
      shipment_fee: v.shipment_fee,
      tax_percent: v.tax_percent,
      tax_amount: taxAmount,
      total,
      total_currency: v.total_currency,
      profit_amount: profitAmount,
      profit_percent: profitPercent,
      language: v.language,
      status: newStatus,
      // Clear rejection_reason if re-submitting.
      ...(v.submit_for_review && status === "rejected" ? { rejection_reason: null } : {}),
    })
    .eq("id", v.id);
  if (updErr) return { ok: false, error: updErr.message };

  // Replace line items wholesale. CASCADE on delete makes this safe.
  const { error: delErr } = await sb
    .from("customer_invoice_items")
    .delete()
    .eq("customer_invoice_id", v.id);
  if (delErr) return { ok: false, error: `Items delete: ${delErr.message}` };

  const itemRows = v.items.map((it, i) => ({
    customer_invoice_id: v.id,
    position: i,
    title: it.title,
    sku: it.sku || null,
    quantity: it.quantity,
    unit_price: it.unit_price,
    line_total: it.quantity * it.unit_price,
    sub_order_id: it.sub_order_id || null,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr } = await (sb.from("customer_invoice_items") as any).insert(itemRows);
  if (insErr) return { ok: false, error: `Items insert: ${insErr.message}` };

  revalidatePath(`/invoices/${v.id}`);
  revalidatePath("/invoices");
  redirect(`/invoices/${v.id}`);
}

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
 * Send the approved invoice's PDF to the customer via Zoho Mail and
 * flip status to 'sent'.
 *
 * Mock mode (Zoho env vars not configured): logs "skipped" to api_logs
 * and still flips status. Lets admins iterate the UI before Zoho is wired.
 *
 * Live mode: only flips status if the email send returns ok. On failure
 * the invoice stays 'approved' so the admin can retry.
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

  // Need: customer email (where to send), invoice_number (for filename + subject),
  // pdf_storage_path (the artifact to attach).
  const { data: invRaw } = await sb
    .from("customer_invoices")
    .select(`
      invoice_number, pdf_storage_path,
      order:orders ( customer:customers ( email ) )
    `)
    .eq("id", id.data)
    .maybeSingle();

  if (!invRaw) return { ok: false, error: "Invoice not found." };

  const inv = invRaw as {
    invoice_number: string;
    pdf_storage_path: string | null;
    order: { customer: { email: string | null } | null } | null;
  };
  const customerEmail = inv.order?.customer?.email ?? null;

  if (!customerEmail) {
    return {
      ok: false,
      error: "Customer has no email address on file. Add one before sending.",
    };
  }

  if (!inv.pdf_storage_path) {
    return {
      ok: false,
      error: "PDF has not been generated yet. Re-approve or use Regenerate PDF first.",
    };
  }

  // Attempt the send (no-op in mock mode).
  let sendResult: Awaited<ReturnType<typeof sendCustomerInvoiceEmail>> | null = null;
  if (isZohoConfigured()) {
    const pdfDownload = await downloadCustomerInvoicePdf(inv.pdf_storage_path);
    if (!pdfDownload.ok) {
      return { ok: false, error: `Couldn't load stored PDF: ${pdfDownload.error}` };
    }
    sendResult = await sendCustomerInvoiceEmail({
      to: customerEmail,
      subject: `Your Trendslet invoice ${inv.invoice_number}`,
      body: `<p>Hi,</p><p>Your invoice <strong>${inv.invoice_number}</strong> is attached.</p><p>Thanks for shopping with Trendslet.</p>`,
      pdf: pdfDownload.buffer,
      filename: `${inv.invoice_number}.pdf`,
      user_id: user.id,
    });

    if (sendResult.error) {
      return { ok: false, error: `Email send failed: ${sendResult.error}` };
    }
  } else {
    // Mock mode — record the skip but proceed. Lets the UI move forward
    // before Zoho credentials are pasted.
    sendResult = await sendCustomerInvoiceEmail({
      to: customerEmail,
      subject: `Your Trendslet invoice ${inv.invoice_number}`,
      body: "",
      pdf: Buffer.alloc(0),
      filename: `${inv.invoice_number}.pdf`,
      user_id: user.id,
    });
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
          sub_orders ( product_title, sku, quantity )
        ),
        supplier_invoice:supplier_invoices ( barcode )
      `)
      .eq("id", invoiceId)
      .maybeSingle();

    if (fetchErr) return { ok: false, error: fetchErr.message };
    if (!inv) return { ok: false, error: "Invoice not found." };

    // Prefer admin-edited line items over the sub_orders 1:1 join.
    // Falls back to sub_orders only when no rows exist (legacy AI-generated
    // invoices that pre-date customer_invoice_items).
    const { data: itemRows } = await sb
      .from("customer_invoice_items")
      .select("title, sku, quantity, unit_price, line_total")
      .eq("customer_invoice_id", invoiceId)
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
