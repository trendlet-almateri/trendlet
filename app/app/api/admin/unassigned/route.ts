import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("sub_orders")
    .select(`
      id, sub_order_number, product_title, brand_name_raw, quantity, unit_price, currency, created_at,
      order:orders ( id, shopify_order_number, customer:customers ( first_name, last_name ) )
    `)
    .eq("is_unassigned", true)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) return NextResponse.json({ rows: [] }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(req: Request) {
  await requireAdmin();
  const { subOrderId } = await req.json();
  if (!subOrderId) return NextResponse.json({ error: "Missing subOrderId" }, { status: 400 });

  const sb = createServiceClient();
  const { data, error } = await sb.rpc("auto_assign_sub_order", { p_sub_order_id: subOrderId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignedTo: data ?? null });
}
