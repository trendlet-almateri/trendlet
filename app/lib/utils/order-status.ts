/**
 * Pure, client-safe constants describing sub-order workflow state.
 * Lives outside lib/queries/* so client components (filters, status pills) can
 * import without pulling in `next/headers` via the Supabase server client.
 */
import type { StatusCode } from "@/lib/constants";

/**
 * Statuses that mean a sub-order is "done" — no further work expected.
 * Shared by the Orders page counts, the filter logic, and any future report.
 */
export const FINAL_STATUSES = new Set<StatusCode>([
  "delivered",
  "cancelled",
  "returned",
]);
