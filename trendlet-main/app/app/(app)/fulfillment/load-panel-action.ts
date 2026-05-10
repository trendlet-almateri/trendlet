"use server";

import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  supplierInvoiceId: z.string().uuid(),
});

export type PanelItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  ai_confidence: "high" | "medium" | "low" | null;
  ai_match_score: number | null;
  ai_reasoning: string | null;
  mapped_sub_order_id: string | null;
};

export type MappableSubOrder = {
  id: string;
  sub_order_number: string;
  product_title: string;
  brand_name: string | null;
};

export type LoadPanelState =
  | {
      ok: true;
      receipt: {
        id: string;
        ocr_state: "uploaded" | "extracting" | "extracted" | "mapped" | "failed";
        supplier_name: string | null;
        invoice_total: number | null;
        currency: string | null;
        barcode: string | null;
      };
      items: PanelItem[];
      mappableSubOrders: MappableSubOrder[];
      hasUnmappedDrafts: boolean;
      error: null;
    }
  | { ok: false; error: string };

/**
 * Phase 4f: load everything the mapping panel needs in a single round
 * trip. RLS scopes the receipt + items to the uploader (or admin), and
 * the sub-order list to what the caller can act on.
 */
export async function loadReceiptPanelAction(input: {
  supplierInvoiceId: string;
}): Promise<LoadPanelState> {
  const user = await requireRole(["sourcing", "fulfiller", "admin"]);

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid id." };
  }

  const sb = createClient();
  const isAdmin = user.roles.includes("admin");

  const { data: receipt, error: rErr } = await sb
    .from("supplier_invoices")
    .select(
      "id, ocr_state, supplier_name, invoice_total, currency, barcode",
    )
    .eq("id", parsed.data.supplierInvoiceId)
    .maybeSingle();
  if (rErr) return { ok: false, error: rErr.message };
  if (!receipt) {
    return { ok: false, error: "Receipt not found or not accessible." };
  }

  const { data: items, error: iErr } = await sb
    .from("supplier_invoice_items")
    .select(
      "id, description, quantity, unit_price, line_total, ai_confidence, ai_match_score, ai_reasoning, mapped_sub_order_id",
    )
    .eq("supplier_invoice_id", receipt.id)
    .order("created_at", { ascending: true });
  if (iErr) return { ok: false, error: iErr.message };

  // Sub-orders the caller can map to: their assigned active sub-orders.
  // Admins see all active sub-orders.
  let soQuery = sb
    .from("sub_orders")
    .select("id, sub_order_number, product_title, brand:brands(name)")
    .in("status", [
      "pending",
      "assigned",
      "unassigned",
      "in_progress",
      "purchased_in_store",
      "purchased_online",
      "delivered_to_warehouse",
      "under_review",
      "preparing_for_shipment",
    ])
    .order("status_changed_at", { ascending: true })
    .limit(50);

  if (!isAdmin) {
    soQuery = soQuery.eq("assigned_employee_id", user.id);
  }

  const { data: subOrders, error: sErr } = await soQuery;
  if (sErr) return { ok: false, error: sErr.message };

  const mappable: MappableSubOrder[] = (subOrders ?? []).map((so) => {
    const brand = (so as { brand: { name: string } | null }).brand;
    return {
      id: so.id,
      sub_order_number: so.sub_order_number,
      product_title: so.product_title,
      brand_name: brand?.name ?? null,
    };
  });

  // Have any items already been mapped but not yet drafted? The "Create
  // drafts" button uses this to show whether there's anything to do.
  const hasUnmappedDrafts =
    (items ?? []).some((it) => it.mapped_sub_order_id !== null) === true;

  return {
    ok: true,
    receipt: {
      id: receipt.id,
      ocr_state: receipt.ocr_state as LoadPanelState extends { ok: true }
        ? LoadPanelState["receipt"]["ocr_state"]
        : never,
      supplier_name: receipt.supplier_name,
      invoice_total: receipt.invoice_total,
      currency: receipt.currency,
      barcode: receipt.barcode,
    },
    items: (items ?? []).map((it) => ({
      id: it.id,
      description: it.description ?? "",
      quantity: it.quantity ?? 1,
      unit_price: Number(it.unit_price ?? 0),
      line_total: Number(it.line_total ?? 0),
      ai_confidence: (it.ai_confidence as PanelItem["ai_confidence"]) ?? null,
      ai_match_score:
        it.ai_match_score === null ? null : Number(it.ai_match_score),
      ai_reasoning: it.ai_reasoning,
      mapped_sub_order_id: it.mapped_sub_order_id,
    })),
    mappableSubOrders: mappable,
    hasUnmappedDrafts,
    error: null,
  };
}
