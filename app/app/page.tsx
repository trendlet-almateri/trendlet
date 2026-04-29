import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";

// getCurrentUser() reads cookies + env vars + queries Supabase. Cannot be
// statically prerendered at build time — Vercel's build env has no request
// context, which crashes the prerender + cascades into error overlay failures.
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Admin → dashboard; non-admin employees → role-specific landing
  if (user.roles.includes("admin")) redirect("/dashboard");
  if (user.roles.includes("ksa_operator")) redirect("/deliveries");
  if (user.roles.includes("fulfiller")) redirect("/fulfillment");
  if (user.roles.includes("warehouse")) redirect("/pipeline");
  redirect("/queue");
}
