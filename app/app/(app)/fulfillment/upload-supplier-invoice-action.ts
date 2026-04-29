"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = "application/pdf";

const schema = z.object({
  subOrderId: z.string().uuid(),
});

export type UploadSupplierInvoiceState =
  | { ok: true; supplierInvoiceId: string; error: null }
  | { ok: false; error: string };

/**
 * Phase 4e: a sourcing employee, fulfiller, or admin drag-and-drops
 * a supplier-receipt PDF onto a sub-order row. We:
 *   1. validate MIME + size
 *   2. upload to the private `supplier-invoices` bucket (service-role)
 *   3. insert a supplier_invoices row (ocr_state='uploaded', source='manual')
 *   4. insert a sub_order_supplier_invoices junction row linking THIS sub-order
 *
 * No AI runs here — that's Phase 4f. Warehouse role is excluded
 * because they don't touch the receipt flow.
 */
export async function uploadSupplierInvoiceAction(
  formData: FormData,
): Promise<UploadSupplierInvoiceState> {
  const user = await requireRole(["sourcing", "fulfiller", "admin"]);

  const subOrderId = formData.get("subOrderId");
  const file = formData.get("file");

  const parsed = schema.safeParse({ subOrderId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid sub-order id." };
  }

  if (!(file instanceof File)) {
    return { ok: false, error: "No file provided." };
  }
  if (file.size === 0) {
    return { ok: false, error: "File is empty." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `File exceeds 10 MB (got ${(file.size / 1024 / 1024).toFixed(1)} MB).` };
  }
  if (file.type !== ALLOWED_MIME) {
    return { ok: false, error: "Only PDF files are accepted." };
  }

  // Ownership check via the user-scoped client BEFORE we touch storage:
  // a non-admin caller can only attach a receipt to a sub-order they can
  // see through RLS (assigned to them, or their region). Without this gate,
  // service-role bypass below would let any sourcer link a receipt to
  // any sub-order's UUID.
  const isAdmin = user.roles.includes("admin");
  if (!isAdmin) {
    const userScoped = createClient();
    const { data: subOrder, error: ownerErr } = await userScoped
      .from("sub_orders")
      .select("id")
      .eq("id", parsed.data.subOrderId)
      .maybeSingle();

    if (ownerErr) {
      return { ok: false, error: `Sub-order lookup failed: ${ownerErr.message}` };
    }
    if (!subOrder) {
      return { ok: false, error: "Sub-order not found or not accessible." };
    }
  }

  // Service-role client for storage upload + RLS-bypass insert. We've
  // already proven the caller is sourcing/fulfiller/admin via requireRole
  // AND that they can see the sub-order via RLS. uploaded_by is hard-coded
  // to user.id so the row stays correctly attributed.
  const sb = createServiceClient();

  const yyyymm = new Date().toISOString().slice(0, 7);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const storagePath = `${user.id}/${yyyymm}/${crypto.randomUUID()}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await sb.storage
    .from("supplier-invoices")
    .upload(storagePath, buffer, {
      contentType: ALLOWED_MIME,
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, error: `Upload failed: ${uploadError.message}` };
  }

  const { data: invoiceRow, error: insertError } = await sb
    .from("supplier_invoices")
    .insert({
      uploaded_by: user.id,
      storage_path: storagePath,
      original_filename: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
      source: "manual",
    })
    .select("id")
    .single();

  if (insertError || !invoiceRow) {
    // Best-effort cleanup: remove the orphan PDF we just uploaded.
    await sb.storage.from("supplier-invoices").remove([storagePath]).catch(() => {});
    return {
      ok: false,
      error: `Failed to record invoice: ${insertError?.message ?? "unknown error"}`,
    };
  }

  const { error: linkError } = await sb
    .from("sub_order_supplier_invoices")
    .insert({
      sub_order_id: parsed.data.subOrderId,
      supplier_invoice_id: invoiceRow.id,
      linked_by: user.id,
    });

  if (linkError) {
    // Compensating cleanup: remove both the supplier_invoices row and
    // the PDF in storage so we don't leak orphans on partial failure.
    try {
      await sb.from("supplier_invoices").delete().eq("id", invoiceRow.id);
    } catch {}
    try {
      await sb.storage.from("supplier-invoices").remove([storagePath]);
    } catch {}
    return { ok: false, error: `Failed to link to sub-order: ${linkError.message}` };
  }

  revalidatePath("/fulfillment");
  revalidatePath("/queue");

  return { ok: true, supplierInvoiceId: invoiceRow.id, error: null };
}
