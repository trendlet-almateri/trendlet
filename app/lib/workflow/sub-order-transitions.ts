import type { StatusCode } from "@/lib/constants";

/**
 * Return the list of statuses an employee in `role` can advance a
 * sub-order TO from its current status. Drives which buttons render
 * on each row in the role queues (fulfillment / warehouse / sourcing).
 *
 * The DB enforce_status_whitelist trigger is the security boundary —
 * this function only decides UI affordances, not authorization.
 *
 * Pipeline (linear with one branch at the "purchased" stage):
 *   in_progress → purchased_online | purchased_in_store | out_of_stock
 *               ↘ purchased_* → delivered_to_warehouse
 *               ↘ delivered_to_warehouse → shipped
 *               ↘ shipped → delivered
 *
 * KSA-side (arrived_in_ksa, out_for_delivery, returned) is reserved for
 * the future shipping-company integration on the ksa_operator role —
 * not part of the live US/EU workflow.
 *
 * `cancelled`, `failed`, and admin-only entry points (`pending`) are
 * not part of any forward path; admin sets them directly.
 */
export type Role = "sourcing" | "warehouse" | "fulfiller" | "ksa_operator" | "admin";

const TRANSITIONS: Record<string, StatusCode[]> = {
  // Entry points — sourcing / fulfiller pick up a pending row
  pending: ["in_progress"],
  assigned: ["in_progress"],
  unassigned: ["in_progress"],

  // Active purchase
  in_progress: ["purchased_in_store", "purchased_online", "out_of_stock"],

  // Bought, ready to hand to warehouse
  purchased_in_store: ["delivered_to_warehouse"],
  purchased_online: ["delivered_to_warehouse"],

  // At warehouse
  delivered_to_warehouse: ["shipped"],

  // In transit (warehouse + fulfiller mark delivered; ksa_operator owns
  // the arrived_in_ksa / out_for_delivery branch)
  shipped: ["delivered"],

  // KSA-operator-only paths (future shipping-company integration)
  arrived_in_ksa: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered", "returned"],

  // Terminal / dormant — no forward transitions
  delivered: [],
  returned: [],
  cancelled: [],
  out_of_stock: [],
  failed: [],
  // under_review / preparing_for_shipment dropped from the active flow
  // (no role's whitelist references them any more — only admin sets them
  // directly if needed).
  under_review: [],
  preparing_for_shipment: [],
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
