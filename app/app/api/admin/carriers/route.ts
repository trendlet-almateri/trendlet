import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  await requireAdmin();
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("carriers")
    .select("id, name, display_name, region, is_active, api_endpoint, created_at")
    .order("display_name", { ascending: true });
  if (error) return NextResponse.json({ carriers: [] });
  return NextResponse.json({ carriers: data ?? [] });
}
