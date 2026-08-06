/**
 * Runs the message plan against the REAL 27-event history of shipment
 * 3701430106 (Elizabeth NJ -> Riyadh, delivered 2026-08-04) and asserts the
 * spec's rules hold: dedup, silent statuses, and the two context-dependent
 * ones (pre-arrival clearance chatter, and a hold before customs completes).
 * Run: npx tsx scripts/check-dhl-customer-messages.mts
 */
import assert from "node:assert/strict";
import { planCustomerMessages } from "../lib/shipping/dhl-customer-messages.ts";

// Verbatim from DHL for 3701430106, newest-first as the API returns them.
const events = [
  { timestamp: "2026-08-04T12:29:00", description: "Delivered" },
  { timestamp: "2026-08-04T12:29:00", description: "Payment is received and recorded for shipment related fees" },
  { timestamp: "2026-08-04T09:30:00", description: "Shipment is out with courier for delivery" },
  { timestamp: "2026-08-04T05:59:00", description: "Arrived at DHL Delivery Facility  RIYADH - SAUDI ARABIA" },
  { timestamp: "2026-08-04T05:15:00", description: "Shipment has departed from a DHL facility RIYADH - SAUDI ARABIA" },
  { timestamp: "2026-08-04T05:14:00", description: "Processed at RIYADH - SAUDI ARABIA" },
  { timestamp: "2026-08-03T23:12:00", description: "Clearance processing complete at RIYADH - SAUDI ARABIA" },
  { timestamp: "2026-08-03T22:54:00", description: "Customs clearance status updated." },
  { timestamp: "2026-08-03T22:50:00", description: "Clearance Event" },
  { timestamp: "2026-08-03T22:46:00", description: "Arrived at DHL Sort Facility  RIYADH - SAUDI ARABIA" },
  { timestamp: "2026-08-03T22:41:00", description: "Customs clearance status updated." },
  { timestamp: "2026-08-03T15:42:00", description: "Customs clearance status updated." },
  { timestamp: "2026-08-03T14:02:00", description: "Customs clearance status updated." },
  { timestamp: "2026-08-03T13:59:00", description: "Customs clearance status updated." },
  { timestamp: "2026-08-03T11:24:00", description: "Shipment has departed from a DHL facility BAHRAIN - BAHRAIN" },
  { timestamp: "2026-08-03T04:51:00", description: "Shipment is on hold" },
  { timestamp: "2026-08-03T01:54:00", description: "Processed at BAHRAIN - BAHRAIN" },
  { timestamp: "2026-08-02T18:51:00", description: "Arrived at DHL Sort Facility  BAHRAIN - BAHRAIN" },
  { timestamp: "2026-08-02T18:04:00", description: "Shipment has departed from a DHL facility DUBAI - UNITED ARAB EMIRATES" },
  { timestamp: "2026-08-02T17:53:00", description: "Shipment is in transit to destination" },
  { timestamp: "2026-08-01T04:06:00", description: "Shipment has departed from a DHL facility CINCINNATI HUB - USA" },
  { timestamp: "2026-08-01T02:49:00", description: "Processed at CINCINNATI HUB - USA" },
  { timestamp: "2026-08-01T01:19:00", description: "Arrived at DHL Sort Facility  CINCINNATI HUB - USA" },
  { timestamp: "2026-08-01T00:18:00", description: "Customs clearance status updated." },
  { timestamp: "2026-07-31T22:47:00", description: "Shipment has departed from a DHL facility ELIZABETH - USA" },
  { timestamp: "2026-07-31T22:46:00", description: "Processed at ELIZABETH - USA" },
  { timestamp: "2026-07-31T17:12:00", description: "Shipment picked up" },
];

const plan = planCustomerMessages(events, new Date("2026-08-06T00:00:00Z"));
console.log(`${events.length} DHL events -> ${plan.length} customer messages\n`);
for (const p of plan) console.log(`  ${p.at.slice(0, 16)}  ${p.key.padEnd(20)} <- "${p.trigger.slice(0, 46)}"`);

// Exactly the six the spec calls for on a clean delivery, in journey order.
assert.deepEqual(
  plan.map((p) => p.key),
  ["picked_up", "usa_processing", "departed_usa", "arrived_ksa", "customs_cleared", "at_trendlet_hq"],
);

// Dedup: 3 US-facility events -> 1 message; 5 clearance updates -> 1 message.
assert.equal(plan.filter((p) => p.key === "usa_processing").length, 1);
assert.equal(plan.filter((p) => p.key === "arrived_ksa").length, 1);

// The Aug-1 00:18 clearance update happened while the shipment was still in
// the US. It must NOT have produced the "arrived in Saudi" message.
const arrived = plan.find((p) => p.key === "arrived_ksa")!;
assert.ok(
  arrived.at >= "2026-08-03T22:46:00",
  `arrived_ksa fired at ${arrived.at} — before the shipment reached Riyadh`,
);

// The Bahrain hold came before customs cleared, so it is silent.
assert.ok(!plan.some((p) => p.key === "delay_after_customs"), "a pre-customs hold must not message the customer");
assert.ok(!plan.some((p) => p.key === "delay_3days"));

// The ELIZABETH departure is an internal US hop — only CINCINNATI means
// "left the country".
assert.match(plan.find((p) => p.key === "departed_usa")!.trigger, /CINCINNATI/);

// ── A hold AFTER customs completes is the delay case ─────────────────────
const stuck = [
  { timestamp: "2026-08-04T06:00:00", description: "Shipment is on hold" },
  { timestamp: "2026-08-03T23:12:00", description: "Clearance processing complete at RIYADH - SAUDI ARABIA" },
  { timestamp: "2026-08-03T22:46:00", description: "Arrived at DHL Sort Facility  RIYADH - SAUDI ARABIA" },
  { timestamp: "2026-07-31T17:12:00", description: "Shipment picked up" },
];
const p1 = planCustomerMessages(stuck, new Date("2026-08-04T12:00:00Z")).map((p) => p.key);
assert.ok(p1.includes("delay_after_customs"), "post-customs hold must send the delay message");
assert.ok(!p1.includes("delay_3days"), "not yet 3 days");

const p2 = planCustomerMessages(stuck, new Date("2026-08-08T12:00:00Z")).map((p) => p.key);
assert.ok(p2.includes("delay_3days"), "hold unresolved 3+ days must escalate");

console.log("\nok — matches the spec on the real timeline");
