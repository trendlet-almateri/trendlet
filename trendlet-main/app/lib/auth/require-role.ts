import { redirect } from "next/navigation";
import { getCurrentUser } from "./get-current-user";
import type { Role } from "@/lib/types/database";

export async function requireRole(allowed: Role[] | Role) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowedArr = Array.isArray(allowed) ? allowed : [allowed];
  const ok = user.roles.some((r) => allowedArr.includes(r));
  if (!ok) redirect("/login?error=forbidden");
  return user;
}

export async function requireAdmin() {
  return requireRole("admin");
}
