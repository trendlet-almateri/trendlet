/**
 * Ingest a Shopify abandoned-checkout payload into Supabase.
 *
 * Fed by the checkouts/create + checkouts/update webhooks. Idempotent on
 * shopify_checkout_id — calling twice upserts the same row (an "update" webhook
 * just refreshes it). Mirrors the shape/idempotency of ingest-order.ts.
 *
 * An "abandoned checkout" is a checkout Shopify still considers incomplete; once
 * it converts to a paid order Shopify stops sending updates. We capture name,
 * email, phone, line items, total and the recovery URL for manual follow-up.
 */
import { createServiceClient } from "@/lib/supabase/server";

type ShopifyCheckoutLineItem = {
  title?: string | null;
  quantity?: number | null;
  price?: string | number | null;
  variant_title?: string | null;
  sku?: string | null;
};

export type ShopifyCheckout = {
  id: number | string;
  token?: string | null;
  email?: string | null;
  phone?: string | null;
  currency?: string | null;
  total_price?: string | number | null;
  abandoned_checkout_url?: string | null;
  created_at?: string | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  } | null;
  shipping_address?: { phone?: string | null } | null;
  line_items?: ShopifyCheckoutLineItem[] | null;
};

export type IngestCheckoutResult =
  | { action: "upserted"; id: string }
  | { action: "skipped"; reason: string };

export async function ingestAbandonedCheckout(
  payload: ShopifyCheckout,
): Promise<IngestCheckoutResult> {
  const checkoutId = payload.id != null ? String(payload.id) : null;
  if (!checkoutId) return { action: "skipped", reason: "no checkout id" };

  const name = payload.customer
    ? [payload.customer.first_name, payload.customer.last_name].filter(Boolean).join(" ")
    : "";
  const phone =
    payload.phone ?? payload.customer?.phone ?? payload.shipping_address?.phone ?? null;

  const lineItems = (payload.line_items ?? []).map((li) => ({
    title: li.title ?? "",
    quantity: Number(li.quantity ?? 1),
    price: li.price != null ? Number(li.price) : null,
    variant_title: li.variant_title ?? null,
    sku: li.sku ?? null,
  }));

  const row = {
    shopify_checkout_id: checkoutId,
    shopify_checkout_token: payload.token ?? null,
    email: payload.email ?? null,
    phone,
    customer_name: name || null,
    currency: payload.currency ?? null,
    total: payload.total_price != null ? Number(payload.total_price) : 0,
    line_items: lineItems,
    recovery_url: payload.abandoned_checkout_url ?? null,
    abandoned_at: payload.created_at ?? null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;
  const { data, error } = await sb
    .from("abandoned_checkouts")
    .upsert(row, { onConflict: "shopify_checkout_id" })
    .select("id")
    .maybeSingle();

  if (error) return { action: "skipped", reason: error.message };
  return { action: "upserted", id: (data as { id: string } | null)?.id ?? "" };
}
