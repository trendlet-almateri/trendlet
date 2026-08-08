import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { StatusCode } from "@/lib/constants";

// Re-export so existing `import { FINAL_STATUSES } from "@/lib/queries/orders"`
// still works for server callers. Client code should import from
// `@/lib/utils/order-status` directly to avoid pulling next/headers transitively.
export { FINAL_STATUSES } from "@/lib/utils/order-status";

export type OrderRow = {
  id: string;
  shopify_order_number: string;
  shopify_created_at: string;
  total: number | null;
  currency: string;
  financial_status: string | null;
  customer: { first_name: string | null; last_name: string | null; default_address: { city?: string; country?: string } | null } | null;
  sub_orders: {
    id: string;
    sub_order_number: string;
    status: StatusCode;
    is_unassigned: boolean;
    is_at_risk: boolean;
    is_delayed: boolean;
    brand_name_raw: string | null;
    product_title: string;
    variant_title: string | null;
    sku: string | null;
    quantity: number;
    product_image_url: string | null;
    /** profiles.id of the employee assigned to this sub-order (null when unassigned). */
    assigned_employee_id: string | null;
    /** Convenience name pulled from the joined profile. */
    assigned_employee_name: string | null;
  }[];
};

/**
 * Fetches admin order list. Uses service-role to bypass RLS — caller must
 * already have validated admin role (via requireAdmin()).
 */
export async function fetchAdminOrders({
  limit = 50,
  filter = "all",
}: {
  limit?: number;
  filter?: "all" | "active" | "delayed" | "done" | "unassigned";
} = {}): Promise<OrderRow[]> {
  // Service-role for admin pricing reads. SERVER-SIDE ONLY.
  const sb = createServiceClient();

  const { data, error } = await sb
    .from("orders")
    .select(`
      id,
      shopify_order_number,
      shopify_created_at,
      total,
      currency,
      financial_status,
      customer:customers ( first_name, last_name, default_address ),
      sub_orders (
        id, sub_order_number, status, is_unassigned, is_at_risk, is_delayed,
        brand_name_raw, product_title, variant_title, sku, quantity, product_image_url,
        assigned_employee_id,
        assigned_employee:profiles!sub_orders_assigned_employee_id_fkey ( full_name )
      )
    `)
    .order("shopify_created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[fetchAdminOrders]", error);
    return [];
  }

  // Flatten the joined assigned_employee.full_name into assigned_employee_name.
  // The Supabase relational select returns the joined object as a nested key,
  // so we normalize it here so the OrderRow consumer never deals with the join shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: OrderRow[] = ((data ?? []) as any[]).map((o) => ({
    ...o,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sub_orders: (o.sub_orders ?? []).map((s: any) => ({
      ...s,
      assigned_employee_name: s.assigned_employee?.full_name ?? null,
    })),
  }));

  if (filter === "all") return rows;
  if (filter === "unassigned") {
    return rows.filter((o) => o.sub_orders.some((s) => s.is_unassigned));
  }
  if (filter === "delayed") {
    return rows.filter((o) => o.sub_orders.some((s) => s.is_delayed));
  }
  if (filter === "done") {
    return rows.filter((o) => o.sub_orders.every((s) => s.status === "delivered" || s.status === "cancelled" || s.status === "returned"));
  }
  // active
  return rows.filter((o) =>
    o.sub_orders.some((s) => s.status !== "delivered" && s.status !== "cancelled" && s.status !== "returned"),
  );
}

export type DashboardKpis = {
  total_orders_30d: number | null;
  active_count: number | null;
  delayed_count: number | null;
  at_risk_count: number | null;
  completed_30d: number | null;
  on_time_pct: number | null;
};

export async function fetchDashboardKpis(): Promise<DashboardKpis | null> {
  const sb = createServiceClient();
  const { data, error } = await sb.from("mv_dashboard_kpis").select("*").maybeSingle();
  if (error) {
    console.error("[fetchDashboardKpis]", error);
    return null;
  }
  return (data as unknown as DashboardKpis) ?? null;
}

export type RevenueByCurrencyRow = {
  currency: string;
  order_count_30d: number;
  total_30d: number;
  prev_order_count: number;
  prev_total: number;
};

export async function fetchRevenueByCurrency(): Promise<RevenueByCurrencyRow[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("mv_revenue_by_currency")
    .select("*")
    .order("total_30d", { ascending: false });
  if (error) {
    console.error("[fetchRevenueByCurrency]", error);
    return [];
  }
  return (data ?? []) as unknown as RevenueByCurrencyRow[];
}

export type TopBrandRow = {
  brand_id: string;
  brand_name: string;
  currency: string;
  items_count: number;
  orders_count: number;
  revenue: number;
};

/**
 * Every brand we have ever ordered from, all time, busiest first.
 *
 * Reads v_brands_all_time — a plain view, so the numbers are live. The
 * mv_top_brands_30d materialized view covers only a rolling month and is 15
 * minutes stale, which hides the long tail: Micheal Kors is the biggest brand
 * by volume all-time but barely registers in a 30-day window.
 */
export async function fetchTopBrands(): Promise<TopBrandRow[]> {
  // v_brands_all_time is newer than the generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;
  const { data, error } = await sb
    .from("v_brands_all_time")
    .select("*")
    .order("items_count", { ascending: false });
  if (error) {
    console.error("[fetchTopBrands]", error);
    return [];
  }
  return (data ?? []) as unknown as TopBrandRow[];
}

export type TeamLoadRow = {
  team: string;
  member_count: number;
  active_items: number;
  load_percent: number;
};

export async function fetchTeamLoad(): Promise<TeamLoadRow[]> {
  const sb = createServiceClient();
  const { data, error } = await sb.from("mv_team_load").select("*");
  if (error) {
    console.error("[fetchTeamLoad]", error);
    return [];
  }
  return (data ?? []) as unknown as TeamLoadRow[];
}
