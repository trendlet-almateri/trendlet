import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { checkAll } from "@/lib/integrations/health";

export async function GET() {
  await requireAdmin();
  const results = await checkAll();
  return NextResponse.json({ results });
}
