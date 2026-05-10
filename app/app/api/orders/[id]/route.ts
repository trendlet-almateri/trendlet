import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = createServiceClient();

  const { data: order, error } = await sb
    .from("orders")
    .select(`
      id, shopify_order_id, shopify_order_number, shopify_created_at,
      total, subtotal, currency, notes, shipping_address,
      customer:customers ( first_name, last_name, email, phone ),
      sub_orders (
        id, sub_order_number, product_title, variant_title, sku,
        quantity, unit_price, currency, status,
        is_unassigned, is_delayed, is_at_risk,
        brand_name_raw, product_image_url
      )
    `)
    .eq("id", params.id)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const subOrderIds = (order.sub_orders as { id: string }[]).map((s) => s.id);

  // Status history (sub-order transitions by team)
  let history: unknown[] = [];
  if (subOrderIds.length) {
    const { data: hist } = await sb
      .from("status_history")
      .select("id, sub_order_id, from_status, to_status, notes, created_at")
      .in("sub_order_id", subOrderIds)
      .order("created_at", { ascending: false })
      .limit(50);
    history = hist ?? [];
  }

  // Order-level events from notifications (Shopify webhooks)
  // Service client bypasses RLS — deduplicate by (type + second) since
  // one row is written per admin user for the same event.
  const { data: rawNotifs } = await sb
    .from("notifications")
    .select("id, type, severity, title, description, created_at")
    .eq("href", `/orders/${params.id}`)
    .order("created_at", { ascending: false })
    .limit(100);

  const seen = new Set<string>();
  const events = (rawNotifs ?? []).filter((n: { type: string; created_at: string }) => {
    const key = `${n.type}:${n.created_at.slice(0, 19)}`; // dedupe within 1s
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json({ order, history, events });
}
