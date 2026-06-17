/**
 * Display formatter for a sub-order number that appends the parent order's
 * total item count, so an operator can see at a glance how many items the
 * order has: "1405-01" with 3 items → "1405-01/3".
 *
 * Display only — the stored sub_order_number stays "1405-01". When the total
 * is unknown or 1, the number is returned unchanged (no "/1" noise).
 */
export function formatSubOrderNumber(
  subOrderNumber: string,
  totalItems?: number | null,
): string {
  if (!totalItems || totalItems <= 1) return subOrderNumber;
  return `${subOrderNumber}/${totalItems}`;
}
