"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-role";
import { checkAll, type IntegrationHealth } from "@/lib/integrations/health";

export async function recheckIntegrationsAction(): Promise<IntegrationHealth[]> {
  await requireAdmin();
  const results = await checkAll();
  revalidatePath("/setup/integrations");
  return results;
}
