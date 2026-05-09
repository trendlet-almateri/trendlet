/**
 * Shared order ingestion logic. Used by:
 *   - The webhook handler (/api/webhooks/shopify/orders-create) for live orders
 *   - The backfill route (/api/admin/shopify-backfill) for historical orders
 *
 * Both paths produce the same DB shape: orders + customers + sub_orders +
 * brand auto-assignment. Idempotent on shopify_order_id — calling twice
 * with the same payload either inserts once or refreshes raw_payload.
 */
import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

type Currency = "SAR" | "USD" | "EUR" | "GBP" | "AED";

type ShopifyAddress = {
  first_name?: string | null;
  last_name?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  zip?: string | null;
  phone?: string | null;
};

type ShopifyLineItem = {
  id: number | string;
  product_id?: number | string | null;
  variant_id?: number | string | null;
  title: string;
  variant_title?: string | null;
  sku?: string | null;
  quantity: number;
  price: string | number;
  vendor?: string | null;
  image_url?: string | null;
};

export type ShopifyOrder = {
  id: number | string;
  order_number: number | string;
  email?: string | null;
  currency: string;
  subtotal_price?: string | null;
  total_price?: string | null;
  customer?: {
    id?: number | string | null;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  } | null;
  shipping_address?: ShopifyAddress | null;
  billing_address?: ShopifyAddress | null;
  line_items: ShopifyLineItem[];
  created_at: string;
  note?: string | null;
};

export type IngestResult =
  | { action: "inserted"; order_id: string; sub_orders_created: number }
  | { action: "refreshed"; order_id: string; reason: "raw_payload updated" }
  | { action: "skipped"; reason: string };

const TRENDLET_STORE_ID =
  process.env.TRENDLET_STORE_ID ?? "db563070-bbf7-4b75-b256-0b93fd44a56f";

/**
 * Ingest a single Shopify order payload into Supabase.
 *
 * Behavior on duplicate shopify_order_id:
 *   - If updateOnDuplicate=true (backfill): UPDATE raw_payload + return "refreshed"
 *   - Otherwise (webhook): leave row alone + return "skipped"
 *
 * Customer upsert is always idempotent (by shopify_customer_id).
 *
 * Sub-orders are created only on first insert. Re-running on an existing
 * order does NOT add duplicate sub_orders or re-route assignments — those
 * are owned by the operations workflow once an order is active.
 */
export async function ingestShopifyOrder(
  payload: ShopifyOrder,
  options: { updateOnDuplicate?: boolean } = {},
): Promise<IngestResult> {
  const sb = createServiceClient();
  const shopifyOrderId = String(payload.id);

  // Check existing
  const { data: existing } = await sb
    .from("orders")
    .select("id")
    .eq("shopify_order_id", shopifyOrderId)
    .maybeSingle<{ id: string }>();

  if (existing) {
    if (!options.updateOnDuplicate) {
      return { action: "skipped", reason: "already ingested" };
    }
    // Refresh raw_payload + headline fields. Don't touch sub_orders or
    // assignments — those are operations state, not Shopify state.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updErr } = await (sb.from("orders") as any)
      .update({
        subtotal: payload.subtotal_price ? Number(payload.subtotal_price) : null,
        total: payload.total_price ? Number(payload.total_price) : null,
        currency: payload.currency as Currency,
        shipping_address: (payload.shipping_address ?? null) as Json,
        billing_address: (payload.billing_address ?? null) as Json,
        notes: payload.note ?? null,
        raw_payload: payload as unknown as Json,
      })
      .eq("id", existing.id);
    if (updErr) {
      return { action: "skipped", reason: `update failed: ${updErr.message}` };
    }
    return { action: "refreshed", order_id: existing.id, reason: "raw_payload updated" };
  }

  // Customer upsert
  let customerId: string | null = null;
  if (payload.customer) {
    const c = payload.customer;
    const shopifyCustomerId = c.id ? String(c.id) : null;
    if (shopifyCustomerId) {
      const customerRow = {
        store_id: TRENDLET_STORE_ID,
        shopify_customer_id: shopifyCustomerId,
        email: c.email ?? null,
        first_name: c.first_name ?? null,
        last_name: c.last_name ?? null,
        phone: c.phone ?? payload.shipping_address?.phone ?? null,
        default_address: (payload.shipping_address ?? null) as Json,
      };
      // The unique constraint on customers is composite: (store_id, shopify_customer_id).
      // Using just "shopify_customer_id" as the conflict target makes Postgres reject
      // the upsert because no single-column unique index matches.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cust, error: custErr } = await (sb.from("customers") as any)
        .upsert(customerRow, { onConflict: "store_id,shopify_customer_id" })
        .select("id")
        .maybeSingle();
      if (custErr) {
        console.error("[ingestShopifyOrder] customer upsert failed", {
          shopify_order_id: shopifyOrderId,
          shopify_customer_id: shopifyCustomerId,
          error: custErr.message,
        });
      }
      customerId = (cust as { id: string } | null)?.id ?? null;
    }
  }

  // Order insert
  const orderRow = {
    store_id: TRENDLET_STORE_ID,
    shopify_order_id: shopifyOrderId,
    shopify_order_number: String(payload.order_number),
    customer_id: customerId,
    subtotal: payload.subtotal_price ? Number(payload.subtotal_price) : null,
    total: payload.total_price ? Number(payload.total_price) : null,
    currency: payload.currency as Currency,
    shipping_address: (payload.shipping_address ?? null) as Json,
    billing_address: (payload.billing_address ?? null) as Json,
    notes: payload.note ?? null,
    raw_payload: payload as unknown as Json,
    shopify_created_at: payload.created_at,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderRaw, error: orderErr } = await (sb.from("orders") as any)
    .insert(orderRow)
    .select("id")
    .maybeSingle();
  const order = orderRaw as { id: string } | null;
  if (orderErr || !order) {
    return { action: "skipped", reason: `order insert failed: ${orderErr?.message ?? "unknown"}` };
  }

  // Sub-orders + brand match + auto-assign
  let subCount = 0;
  for (let i = 0; i < payload.line_items.length; i++) {
    const li = payload.line_items[i];
    const subOrderNumber = `${payload.order_number}-${String(i + 1).padStart(2, "0")}`;

    let brandId: string | null = null;
    if (li.vendor) {
      const { data: brand } = await sb.rpc("match_brand_from_vendor", { p_vendor: li.vendor });
      brandId = (brand as string | null) ?? null;
    }

    const subRow = {
      order_id: order.id,
      sub_order_number: subOrderNumber,
      shopify_line_item_id: String(li.id),
      product_title: li.title,
      variant_title: li.variant_title ?? null,
      sku: li.sku ?? null,
      quantity: li.quantity,
      product_image_url: li.image_url ?? null,
      unit_price: li.price ? Number(li.price) : null,
      currency: payload.currency as Currency,
      brand_id: brandId,
      brand_name_raw: li.vendor ?? null,
      is_unassigned: !brandId,
      status: "pending",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: subRaw, error: subErr } = await (sb.from("sub_orders") as any)
      .insert(subRow)
      .select("id")
      .maybeSingle();
    const sub = subRaw as { id: string } | null;
    if (subErr || !sub) continue;

    if (brandId) {
      await sb.rpc("auto_assign_sub_order", { p_sub_order_id: sub.id });
    }
    subCount++;
  }

  return { action: "inserted", order_id: order.id, sub_orders_created: subCount };
}
