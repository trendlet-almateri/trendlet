"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const schema = z.object({
  itemId: z.string().uuid(),
  subOrderId: z.string().uuid().nullable(),
});

export type MapItemState =
  | { ok: true; error: null }
  | { ok: false; error: string };

/**
 * Phase 4f: assign an extracted line item to a sub-order, or clear the
 * mapping when subOrderId is null. Both source (the supplier_invoice
 * the item belongs to) and target (the sub_order being mapped) are
 * RLS-checked through the user-scoped client; we then write through
 * service-role because supplier_invoice_items has admin-only RLS today.
 */
export async function mapSupplierInvoiceItemAction(input: {
  itemId: string;
  subOrderId: string | null;
}): Promise<MapItemState> {
  const user = await requireRole(["sourcing", "fulfiller", "admin"]);

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const userScoped = createClient();
  const sb = createServiceClient();

  // Fetch the item via service-role (RLS bypass) but verify ownership of
  // the parent supplier_invoice through the user-scoped client.
  const { data: item, error: itemErr } = await sb
    .from("supplier_invoice_items")
    .select("id, supplier_invoice_id")
    .eq("id", parsed.data.itemId)
    .maybeSingle();
  if (itemErr) return { ok: false, error: itemErr.message };
  if (!item) return { ok: false, error: "Line item not found." };

  const { data: parent, error: parentErr } = await userScoped
    .from("supplier_invoices")
    .select("id")
    .eq("id", item.supplier_invoice_id)
    .maybeSingle();
  if (parentErr) return { ok: false, error: parentErr.message };
  if (!parent) {
    return { ok: false, error: "You don't have access to this receipt." };
  }

  // Verify caller can see the target sub-order (when assigning).
  if (parsed.data.subOrderId) {
    const { data: subOrder, error: soErr } = await userScoped
      .from("sub_orders")
      .select("id")
      .eq("id", parsed.data.subOrderId)
      .maybeSingle();
    if (soErr) return { ok: false, error: soErr.message };
    if (!subOrder) {
      return { ok: false, error: "Sub-order not found or not accessible." };
    }
  }

  const { error: updErr } = await sb
    .from("supplier_invoice_items")
    .update({
      mapped_sub_order_id: parsed.data.subOrderId,
      mapped_at: parsed.data.subOrderId ? new Date().toISOString() : null,
      mapped_by: parsed.data.subOrderId ? user.id : null,
    })
    .eq("id", parsed.data.itemId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/fulfillment");
  revalidatePath("/queue");
  return { ok: true, error: null };
}
