"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createServiceClient } from "@/lib/supabase/server";

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
 * Approve a pending_review invoice.
 * Records reviewer + timestamp. Status moves to 'approved'.
 * PDF generation and customer email are out of scope for Phase 1.
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

  revalidatePath(`/invoices/${id.data}`);
  revalidatePath("/invoices");
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
