"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { getProductExtra, setProductExtra } from "@/lib/integrations/shopify-metafields";
import { regenerateTaxInvoicePdf } from "@/lib/services/regenerate-tax-invoice-pdf";

export type MissingExtraProduct = { product_id: string; title: string };

/** Products on this invoice's order that have NO custom.extra set in Shopify. */
export async function getMissingExtraProducts(invoiceId: string): Promise<MissingExtraProduct[]> {
  await requireRole(["admin"]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;
  const { data: inv } = await sb
    .from("tax_invoices")
    .select("order:orders ( raw_payload )")
    .eq("id", invoiceId)
    .maybeSingle();

  const items = (inv?.order?.raw_payload?.line_items ?? []) as { product_id?: string | number; title?: string }[];
  // De-dupe by product_id (multi-line same product) and keep only those missing extra.
  const seen = new Set<string>();
  const out: MissingExtraProduct[] = [];
  for (const li of items) {
    if (li.product_id == null) continue;
    const pid = String(li.product_id);
    if (seen.has(pid)) continue;
    seen.add(pid);
    const extra = await getProductExtra(pid);
    if (extra == null) out.push({ product_id: pid, title: li.title ?? pid });
  }
  return out;
}

/**
 * Write the admin-entered extra values to Shopify (one per product), then
 * regenerate this invoice's PDF so the new shipping is picked up.
 */
export async function saveExtrasAndRegenerate(
  invoiceId: string,
  extras: { product_id: string; value: number }[],
): Promise<{ ok: boolean; error?: string }> {
  await requireRole(["admin"]);
  try {
    for (const e of extras) {
      if (!Number.isFinite(e.value) || e.value < 0) continue;
      await setProductExtra(e.product_id, e.value);
    }
    await regenerateTaxInvoicePdf(invoiceId);
    revalidatePath(`/tax-invoices/${invoiceId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
