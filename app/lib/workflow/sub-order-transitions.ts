import type { StatusCode } from "@/lib/constants";

/**
 * Return the list of statuses an employee in `role` can advance a
 * sub-order TO from its current status. Drives which buttons render
 * on each row in the role queues (fulfillment / warehouse / sourcing).
 *
 * The DB enforce_status_whitelist trigger is the security boundary —
 * this function only decides UI affordances, not authorization.
 *
 * Pipeline (linear with branches at the "purchased" stage):
 *   pending → assigned → in_progress
 *           ↘ in_progress → purchased_online | purchased_in_store | out_of_stock
 *           ↘ purchased_* → delivered_to_warehouse
 *           ↘ delivered_to_warehouse → under_review (skipping under_review is fine)
 *           ↘ delivered_to_warehouse → preparing_for_shipment
 *           ↘ preparing_for_shipment → shipped
 *           ↘ shipped → arrived_in_ksa
 *           ↘ arrived_in_ksa → out_for_delivery | delivered
 *           ↘ out_for_delivery → delivered | returned
 *
 * `cancelled` is available from any pre-shipped state but renders
 * separately (destructive action) — not in this map.
 */
export type Role = "sourcing" | "warehouse" | "fulfiller" | "ksa_operator" | "admin";

const TRANSITIONS: Record<string, StatusCode[]> = {
  // Pre-purchase
  pending: ["in_progress", "out_of_stock"],
  assigned: ["in_progress", "out_of_stock"],
  unassigned: ["in_progress"],

  // Active purchase
  in_progress: ["purchased_in_store", "purchased_online", "out_of_stock"],

  // Bought, ready to hand to warehouse
  purchased_in_store: ["delivered_to_warehouse"],
  purchased_online: ["delivered_to_warehouse"],

  // At warehouse
  delivered_to_warehouse: ["shipped", "under_review", "preparing_for_shipment"],
  under_review: ["preparing_for_shipment", "shipped"],
  preparing_for_shipment: ["shipped"],

  // In transit + KSA
  // shipped→delivered direct path lets warehouse close out fulfilment when
  // they're the ones handing off to the KSA customer; the silent
  // arrived_in_ksa waypoint stays available for orders that go through the
  // KSA operator workflow.
  shipped: ["arrived_in_ksa", "delivered"],
  arrived_in_ksa: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered", "returned"],

  // Terminal — no transitions onward
  delivered: [],
  returned: [],
  cancelled: [],
  out_of_stock: [],
  failed: [],
};

/**
 * Filter the canonical transition list to those the role is allowed
 * to perform. Admin bypasses the filter (sees every transition).
 */
export function getNextStatuses(
  currentStatus: string,
  role: Role,
  whitelist: Record<string, string[]>,
): StatusCode[] {
  const candidates = TRANSITIONS[currentStatus] ?? [];
  if (role === "admin") return candidates;
  const allowed = new Set(whitelist[role] ?? []);
  return candidates.filter((s) => allowed.has(s));
}
