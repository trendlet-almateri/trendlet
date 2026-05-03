import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { fetchTeamMembers, fetchPendingInvitations } from "@/lib/queries/team";

export async function GET() {
  await requireAdmin();
  const [members, pending] = await Promise.all([
    fetchTeamMembers(),
    fetchPendingInvitations(),
  ]);
  return NextResponse.json({ members, pending });
}
