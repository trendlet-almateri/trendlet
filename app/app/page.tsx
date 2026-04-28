import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Admin → dashboard; non-admin employees → role-specific landing
  if (user.roles.includes("admin")) redirect("/dashboard");
  if (user.roles.includes("ksa_operator")) redirect("/deliveries");
  if (user.roles.includes("warehouse")) redirect("/pipeline");
  redirect("/queue");
}
