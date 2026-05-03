import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  await requireAdmin();
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("stores")
    .select("id, name, shopify_domain, region, is_active, default_currency, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ stores: [] });
  return NextResponse.json({ stores: data ?? [] });
}
