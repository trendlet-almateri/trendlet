/**
 * Derive an order's cancellation state from its sub-orders.
 *
 * An "order" has no status column — it is the sum of its sub_orders.
 * A cancel acts on ONE sub-order, so an order can be:
 *   - "none"    : no sub-order cancelled (normal)
 *   - "partial" : some (>=1) but NOT all sub-orders cancelled — the order
 *                 is still being fulfilled, but part of it was killed
 *   - "all"     : every sub-order cancelled — the whole order is dead
 *
 * Used by every order-summary surface (orders table row, OrderDrawer
 * header, /orders/[id] header) so they show the SAME thing — avoids the
 * drift where each view computed cancel state differently.
 */

export type OrderCancelState = "none" | "partial" | "all";

export function deriveOrderCancelState(
  subOrders: { status: string }[],
): OrderCancelState {
  if (subOrders.length === 0) return "none";
  const cancelledCount = subOrders.filter((s) => s.status === "cancelled").length;
  if (cancelledCount === 0) return "none";
  if (cancelledCount === subOrders.length) return "all";
  return "partial";
}

/** Short human label for a badge. null when state is "none". */
export function orderCancelLabel(state: OrderCancelState): string | null {
  if (state === "all") return "Cancelled";
  if (state === "partial") return "Partially cancelled";
  return null;
}
