/**
 * PerformerTag — admin-only "who took this action" line for the role-queue
 * cards (Sourcing / Warehouse / EU fulfillment).
 *
 * `changedBy` comes from FulfillmentRow.changed_by, which the server
 * (fetchFulfillmentQueue) populates ONLY for admin viewers and leaves null
 * otherwise. So this renders nothing for non-admins with no extra check —
 * the identity is never in their payload in the first place.
 *
 * Wording is status-aware: "Cancelled by" on cancelled rows, "Completed by"
 * on the read-only (Completed) tab, else "Updated by".
 */
export function PerformerTag({
  changedBy,
  status,
  isReadOnly,
}: {
  changedBy: { name: string; role: string | null } | null;
  status: string;
  isReadOnly: boolean;
}) {
  if (!changedBy) return null;

  const verb =
    status === "cancelled" ? "Cancelled by" : isReadOnly ? "Completed by" : "Updated by";

  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]">
      <span aria-hidden>·</span>
      {verb}{" "}
      <span className="font-medium text-[var(--ink-2)]">{changedBy.name}</span>
      {changedBy.role && <span>({changedBy.role})</span>}
    </span>
  );
}
