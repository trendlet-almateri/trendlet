import { createClient, createServiceClient } from "@/lib/supabase/server";

export type FulfillmentRow = {
  id: string;
  sub_order_number: string;
  product_title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  product_image_url: string | null;
  status: string;
  status_changed_at: string;
  is_at_risk: boolean;
  is_delayed: boolean;
  brand: {
    id: string;
    name: string;
    region: string | null;
  } | null;
  order: {
    id: string;
    shopify_order_number: string | null;
    customer_name: string;
    customer_city: string | null;
  } | null;
};

type Region = "EU" | "US";

const ACTIVE_STATUSES = [
  "pending",
  "assigned",
  "unassigned",
  "in_progress",
  "purchased_in_store",
  "purchased_online",
  "delivered_to_warehouse",
  "under_review",
  "preparing_for_shipment",
  "shipped",
  "arrived_in_ksa",
  "out_for_delivery",
];

/**
 * Fetch active sub-orders for the EU/fulfiller queue.
 *
 * Filters:
 *   - brand.region = 'EU'
 *   - status NOT terminal (delivered, returned, cancelled, out_of_stock, failed)
 *   - if `userId` is provided (non-admin): assigned_employee_id = userId
 *
 * Admin sees the entire EU pipeline; the fulfiller sees only what's
 * theirs. RLS already scopes employee reads, but we add the explicit
 * `assigned_employee_id` filter to keep the query result consistent
 * with what's actually theirs to act on.
 */
export async function fetchFulfillmentQueue(opts: {
  region: Region;
  userId: string;
  isAdmin: boolean;
}): Promise<FulfillmentRow[]> {
  const sb = opts.isAdmin ? createServiceClient() : createClient();

  let query = sb
    .from("sub_orders")
    .select(`
      id, sub_order_number, product_title, variant_title, sku, quantity,
      product_image_url, status, status_changed_at, is_at_risk, is_delayed,
      brand:brands ( id, name, region ),
      order:orders (
        id, shopify_order_number,
        customer:customers ( first_name, last_name, default_address )
      )
    `)
    .in("status", ACTIVE_STATUSES)
    .order("status_changed_at", { ascending: true });

  if (!opts.isAdmin) {
    query = query.eq("assigned_employee_id", opts.userId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Filter by brand region in JS (PostgREST nested filtering is awkward
  // for the .eq on joined relation in this version of @supabase/ssr).
  return (data ?? [])
    .filter((row) => {
      const brand = (row as { brand: { region: string | null } | null }).brand;
      return brand?.region === opts.region;
    })
    .map((row) => {
      const r = row as unknown as {
        id: string;
        sub_order_number: string;
        product_title: string;
        variant_title: string | null;
        sku: string | null;
        quantity: number;
        product_image_url: string | null;
        status: string;
        status_changed_at: string;
        is_at_risk: boolean;
        is_delayed: boolean;
        brand: { id: string; name: string; region: string | null } | null;
        order: {
          id: string;
          shopify_order_number: string | null;
          customer: {
            first_name: string | null;
            last_name: string | null;
            default_address: { city?: string | null } | null;
          } | null;
        } | null;
      };
      const c = r.order?.customer;
      const fullName =
        c
          ? [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "—"
          : "—";
      return {
        id: r.id,
        sub_order_number: r.sub_order_number,
        product_title: r.product_title,
        variant_title: r.variant_title,
        sku: r.sku,
        quantity: r.quantity,
        product_image_url: r.product_image_url,
        status: r.status,
        status_changed_at: r.status_changed_at,
        is_at_risk: r.is_at_risk,
        is_delayed: r.is_delayed,
        brand: r.brand,
        order: r.order
          ? {
              id: r.order.id,
              shopify_order_number: r.order.shopify_order_number,
              customer_name: fullName,
              customer_city: c?.default_address?.city ?? null,
            }
          : null,
      };
    });
}
