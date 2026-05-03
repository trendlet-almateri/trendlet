import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { fetchAssigneeOptions } from "@/lib/queries/brands";

export async function GET() {
  await requireAdmin();
  const assignees = await fetchAssigneeOptions();
  return NextResponse.json({ assignees });
}
