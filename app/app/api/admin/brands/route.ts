import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { fetchBrandsForAdmin, fetchAssignmentsByEmployee } from "@/lib/queries/brands";

export async function GET() {
  await requireAdmin();
  const [brands, assignmentsByEmployee] = await Promise.all([
    fetchBrandsForAdmin(),
    fetchAssignmentsByEmployee(),
  ]);
  return NextResponse.json({ brands, assignmentsByEmployee });
}
