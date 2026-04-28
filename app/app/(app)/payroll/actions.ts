"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-role";
import { syncHubstaff, type HubstaffSyncResult } from "@/lib/integrations/hubstaff";

/**
 * Admin-triggered Hubstaff sync. Same code path as the hourly cron, but
 * invoked from the "Sync now" button on /payroll. Pulls the last 24h.
 */
export async function syncHubstaffAction(): Promise<HubstaffSyncResult> {
  await requireAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await syncHubstaff({ since });
  revalidatePath("/payroll");
  return result;
}
