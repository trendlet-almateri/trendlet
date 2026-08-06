/**
 * DHL tracking event → customer WhatsApp message.
 *
 * Source: "Trendlet DHL Status → Customer Messages". Only 8 of the ~27 events
 * DHL emits are customer-facing; the rest are deliberately silent.
 *
 * Two rules make this a state machine rather than a lookup table:
 *
 *  1. Each message is sent AT MOST ONCE per shipment. Several DHL statuses map
 *     to the same message (three different US-facility events all mean "in the
 *     US warehouses"), and the spec says to send only if not already sent.
 *
 *  2. Two statuses mean different things depending on where the shipment is in
 *     its journey, so events must be read oldest-first while tracking what has
 *     already happened:
 *       - "Customs clearance status updated" fires while the shipment is still
 *         in Bahrain (pre-arrival). Treating that as "arrived in Saudi" would
 *         tell the customer it landed days early. Only counts once the Riyadh
 *         arrival event has been seen.
 *       - "Shipment on hold" is silent during transit and customs, but AFTER
 *         clearance completes it means DHL failed to hand over to Trendlet HQ,
 *         which is the delay message.
 *
 * The DHL tracking number must never appear in a customer message (spec note);
 * enforced by the fact that no message body takes a tracking parameter.
 */

export type CustomerMessageKey =
  | "picked_up"
  | "usa_processing"
  | "departed_usa"
  | "arrived_ksa"
  | "customs_cleared"
  | "at_trendlet_hq"
  | "delay_after_customs"
  | "delay_3days";

export type PlannedMessage = {
  key: CustomerMessageKey;
  /** Timestamp of the DHL event that triggered it. */
  at: string;
  /** The event description, for audit/logging. */
  trigger: string;
};

type Event = { timestamp: string; description: string; status_code?: string | null; location?: string | null };

const has = (s: string, ...needles: string[]) =>
  needles.every((n) => s.toLowerCase().includes(n.toLowerCase()));

/** Days a post-customs hold must persist before the second delay message. */
const HOLD_ESCALATION_DAYS = 3;

/**
 * Decides which customer messages a shipment's history warrants, in order.
 * Pure: same events always produce the same plan, so it is safe to re-run on
 * every poll and diff against what was already sent.
 */
export function planCustomerMessages(events: Event[], now = new Date()): PlannedMessage[] {
  // DHL returns newest-first; the state machine needs oldest-first.
  const ordered = [...events]
    .filter((e) => e.timestamp)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const plan: PlannedMessage[] = [];
  const sent = new Set<CustomerMessageKey>();
  const push = (key: CustomerMessageKey, e: Event) => {
    if (sent.has(key)) return;
    sent.add(key);
    plan.push({ key, at: e.timestamp, trigger: e.description });
  };

  let arrivedInKsa = false;
  let customsCleared = false;
  let holdAfterCustomsAt: string | null = null;

  for (const e of ordered) {
    const d = e.description ?? "";

    // ── Stage 1: pickup + US facilities ──────────────────────────────────
    if (has(d, "picked up")) {
      push("picked_up", e);
      continue;
    }
    if (has(d, "processed at", "elizabeth") || has(d, "sort facility", "cincinnati") || has(d, "processed at", "cincinnati")) {
      push("usa_processing", e);
      continue;
    }

    // ── Stage 2: departure from the US ───────────────────────────────────
    // Only the CINCINNATI departure means "left the country". The ELIZABETH
    // departure is an internal US hop and is silent.
    if (has(d, "departed", "cincinnati")) {
      push("departed_usa", e);
      continue;
    }

    // ── Stage 3: Riyadh arrival + customs ────────────────────────────────
    if (has(d, "sort facility", "riyadh")) {
      arrivedInKsa = true;
      push("arrived_ksa", e);
      continue;
    }
    if (has(d, "clearance processing complete")) {
      customsCleared = true;
      push("customs_cleared", e);
      continue;
    }
    // Clearance chatter counts as "arrived" only after the shipment really did.
    if (arrivedInKsa && !customsCleared && (has(d, "clearance event") || has(d, "customs clearance status updated"))) {
      push("arrived_ksa", e);
      continue;
    }

    // ── Stage 4: handed over to Trendlet HQ ──────────────────────────────
    if (has(d, "delivered")) {
      push("at_trendlet_hq", e);
      continue;
    }

    // ── Stage 5: delays, but only once customs is done ───────────────────
    if (customsCleared && (has(d, "on hold") || has(d, "not accepted") || has(d, "delivery attempted"))) {
      push("delay_after_customs", e);
      holdAfterCustomsAt = holdAfterCustomsAt ?? e.timestamp;
      continue;
    }
  }

  // A post-customs hold still unresolved after 3+ days gets the reassurance
  // message. "Unresolved" = never delivered to Trendlet HQ.
  if (holdAfterCustomsAt && !sent.has("at_trendlet_hq")) {
    const heldMs = now.getTime() - new Date(holdAfterCustomsAt).getTime();
    if (heldMs >= HOLD_ESCALATION_DAYS * 24 * 60 * 60 * 1000) {
      plan.push({ key: "delay_3days", at: holdAfterCustomsAt, trigger: "hold unresolved 3+ days" });
    }
  }

  return plan;
}
