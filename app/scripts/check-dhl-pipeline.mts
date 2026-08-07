/**
 * Health check for the whole DHL → customer notification chain.
 *
 *   npx tsx scripts/check-dhl-pipeline.mts
 *
 * SAFE TO RUN ANY TIME, including after Meta approves the templates: it never
 * calls the send path, so it cannot message a real customer. It exercises the
 * planner, the config invariants, the schema guarantees and live connectivity,
 * and fails loudly on any broken link.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  planCustomerMessages,
  MESSAGE_BODIES,
  TEMPLATE_NAMES,
  TEMPLATE_SIDS,
  MESSAGE_LABELS,
  type CustomerMessageKey,
} from "../lib/shipping/dhl-customer-messages.ts";

const env = Object.fromEntries(
  readFileSync("./.env.local", "utf8").split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
// The tracking key is DHL_API_Key in code/Vercel but DHL_API_KEY locally.
process.env.DHL_API_Key ??= env.DHL_API_Key ?? env.DHL_API_KEY;

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);
const twilioAuth = "Basic " + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");

const KEYS = Object.keys(TEMPLATE_SIDS) as CustomerMessageKey[];
let failures = 0;
const ok = (n: string, msg = "") => console.log(`  PASS  ${n}${msg ? ` — ${msg}` : ""}`);
const bad = (n: string, msg: string) => { failures++; console.log(`  FAIL  ${n} — ${msg}`); };

// ── 1. message plan on a real 27-event history ───────────────────────────
console.log("\n1. Message planner");
{
  const ev = (t: string, d: string) => ({ timestamp: t, description: d });
  const plan = planCustomerMessages([
    ev("2026-08-04T12:29:00", "Delivered"),
    ev("2026-08-04T09:30:00", "Shipment is out with courier for delivery"),
    ev("2026-08-03T23:12:00", "Clearance processing complete at RIYADH - SAUDI ARABIA"),
    ev("2026-08-03T22:46:00", "Arrived at DHL Sort Facility  RIYADH - SAUDI ARABIA"),
    ev("2026-08-03T04:51:00", "Shipment is on hold"),
    ev("2026-08-01T04:06:00", "Shipment has departed from a DHL facility CINCINNATI HUB - USA"),
    ev("2026-08-01T00:18:00", "Customs clearance status updated."),
    ev("2026-07-31T22:47:00", "Shipment has departed from a DHL facility ELIZABETH - USA"),
    ev("2026-07-31T22:46:00", "Processed at ELIZABETH - USA"),
    ev("2026-07-31T17:12:00", "Shipment picked up"),
  ]);
  const got = plan.map((p) => p.key).join(",");
  const want = "picked_up,usa_processing,departed_usa,arrived_ksa,customs_cleared,at_trendlet_hq";
  got === want ? ok("milestones", got.replace(/,/g, " → ")) : bad("milestones", `got ${got}`);

  const arrived = plan.find((p) => p.key === "arrived_ksa");
  arrived && arrived.at >= "2026-08-03T22:46:00"
    ? ok("pre-arrival customs chatter ignored")
    : bad("pre-arrival customs chatter ignored", `arrived_ksa fired at ${arrived?.at}`);

  plan.some((p) => p.key === "delay_after_customs")
    ? bad("pre-customs hold stays silent", "a hold before customs messaged the customer")
    : ok("pre-customs hold stays silent");
}

// ── 2. every message has a body, a name and a SID ────────────────────────
console.log("\n2. Message definitions");
{
  const missing = KEYS.filter((k) => !MESSAGE_BODIES[k]?.trim() || !TEMPLATE_NAMES[k] || !MESSAGE_LABELS[k]);
  missing.length === 0 ? ok("all 8 defined") : bad("all 8 defined", `incomplete: ${missing.join(", ")}`);

  const noVars = KEYS.filter((k) => !MESSAGE_BODIES[k].includes("{{1}}") || !MESSAGE_BODIES[k].includes("{{2}}"));
  noVars.length === 0 ? ok("order reference in every message") : bad("order reference in every message", noVars.join(", "));

  // The spec forbids the DHL tracking number reaching the customer.
  const leaks = KEYS.filter((k) => /\{\{3\}\}|tracking number|رقم التتبع الدولي/i.test(MESSAGE_BODIES[k]));
  leaks.length === 0 ? ok("no DHL tracking number exposed") : bad("no DHL tracking number exposed", leaks.join(", "));
}

// ── 3. Twilio templates exist and match the repo ─────────────────────────
console.log("\n3. Twilio templates");
{
  const res = await fetch("https://content.twilio.com/v1/Content?PageSize=200", { headers: { Authorization: twilioAuth } });
  const contents = (await res.json()).contents ?? [];
  const bySid = new Map<string, { friendly_name: string; body: string }>(
    contents.map((c: { sid: string; friendly_name: string; types: Record<string, { body?: string }> }) =>
      [c.sid, { friendly_name: c.friendly_name, body: c.types?.["twilio/text"]?.body ?? "" }]),
  );

  const unknown = KEYS.filter((k) => !bySid.has(TEMPLATE_SIDS[k]));
  unknown.length === 0
    ? ok("all 8 SIDs resolve on the account")
    : bad("all 8 SIDs resolve on the account", `dangling: ${unknown.join(", ")}`);

  const drifted = KEYS.filter((k) => bySid.has(TEMPLATE_SIDS[k]) && bySid.get(TEMPLATE_SIDS[k])!.body !== MESSAGE_BODIES[k]);
  drifted.length === 0
    ? ok("Twilio text matches the repo")
    : bad("Twilio text matches the repo", `edited in Twilio: ${drifted.join(", ")}`);

  const approvals = await Promise.all(KEYS.map(async (k) => {
    const r = await fetch(`https://content.twilio.com/v1/Content/${TEMPLATE_SIDS[k]}/ApprovalRequests`, { headers: { Authorization: twilioAuth } });
    return [k, r.ok ? ((await r.json())?.whatsapp?.status ?? "unsubmitted") : "unknown"] as const;
  }));
  const approved = approvals.filter(([, s]) => s === "approved").map(([k]) => k);
  console.log(`  INFO  Meta approval: ${approved.length}/8 approved` +
    (approved.length < 8 ? ` — pending: ${approvals.filter(([, s]) => s !== "approved").map(([k, s]) => `${k}(${s})`).join(", ")}` : ""));
  if (approved.length < 8) console.log("        (nothing will be sent until these are approved — by design)");
}

// ── 4. status config: the double-message guard ───────────────────────────
console.log("\n4. Status configuration");
{
  const { data } = await sb.from("statuses").select("key, notifies_customer, twilio_template_sid");
  const rows = (data ?? []) as { key: string; notifies_customer: boolean; twilio_template_sid: string | null }[];
  const armed = rows.filter((r) => r.notifies_customer).map((r) => r.key).sort();
  const want = ["out_of_stock", "preparing_for_shipment", "purchased_in_store", "purchased_online", "under_review"];

  armed.join(",") === want.join(",")
    ? ok("staff messaging stops at preparing_for_shipment", armed.join(", "))
    : bad("staff messaging stops at preparing_for_shipment", `armed = ${armed.join(", ")}`);

  // DHL never writes sub-order statuses — it is a notification source only.
  // These two would otherwise be the tempting targets, so assert they stay
  // silent: arming either would mean a customer gets the DHL message and the
  // status message for the same event.
  for (const key of ["arrived_in_ksa", "delivered_to_warehouse"]) {
    const row = rows.find((r) => r.key === key);
    if (!row) bad(`${key} exists`, "status missing from the table");
    else if (row.notifies_customer) bad(`${key} stays silent`, "ARMED — would double-message every customer");
    else ok(`${key} stays silent`);
  }

  const armedNoTemplate = rows.filter((r) => r.notifies_customer && !r.twilio_template_sid).map((r) => r.key);
  armedNoTemplate.length === 0 ? ok("every armed status has a template") : bad("every armed status has a template", armedNoTemplate.join(", "));
}

// ── 5. schema guarantees ────────────────────────────────────────────────
console.log("\n5. Schema");
{
  const { data: ship } = await sb.from("shipments").select("id").limit(1).maybeSingle();
  const { data: sub } = await sb.from("sub_orders").select("id").limit(1).maybeSingle();

  if (!ship || !sub) {
    bad("ledger uniqueness", "no shipment/sub-order available to test against");
  } else {
    const row = { shipment_id: (ship as { id: string }).id, sub_order_id: (sub as { id: string }).id, message_key: "__pipeline_check__" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = sb.from("shipment_message_log") as any;
    await t.delete().eq("message_key", row.message_key);
    const first = await t.insert(row);
    const second = await t.insert(row); // must be rejected
    await t.delete().eq("message_key", row.message_key);

    !first.error && second.error
      ? ok("ledger blocks a duplicate send", "UNIQUE(shipment, sub_order, message_key)")
      : bad("ledger blocks a duplicate send",
          first.error ? `first insert failed: ${first.error.message}` : "DUPLICATE ACCEPTED — a customer could be messaged twice");
  }

  const { error: linkErr } = await sb.from("shipment_sub_orders").select("shipment_id").limit(1);
  linkErr ? bad("shipment_sub_orders readable", linkErr.message) : ok("shipment_sub_orders readable");
}

// ── 6. live DHL connectivity ────────────────────────────────────────────
console.log("\n6. DHL connectivity");
{
  const key = process.env.DHL_API_Key;
  if (!key) bad("DHL API key present", "DHL_API_Key / DHL_API_KEY not set");
  else {
    const r = await fetch("https://api-eu.dhl.com/track/shipments?trackingNumber=3701430106", {
      headers: { "DHL-API-Key": key, Accept: "application/json" },
    });
    // 200 = found, 404 = authenticated but aged out. 401/403 = bad key.
    r.status === 200 || r.status === 404
      ? ok("DHL reachable and authenticated", `HTTP ${r.status}`)
      : bad("DHL reachable and authenticated", `HTTP ${r.status} — check the API key`);
  }
}

// ── 7. the scheduler is actually wired ──────────────────────────────────
console.log("\n7. Scheduler");
{
  const vercel = JSON.parse(readFileSync("./vercel.json", "utf8")) as { crons?: { path: string; schedule: string }[] };
  const cron = (vercel.crons ?? []).find((c) => c.path.includes("dhl-status-notify"));
  if (!cron) bad("cron registered", "no dhl-status-notify entry in vercel.json — nothing would ever run");
  else if (cron.schedule !== "0 */6 * * *") bad("cron runs every 6 hours", `schedule is "${cron.schedule}"`);
  else ok("cron runs every 6 hours", cron.schedule);
}

// ── 8. real shipments are linked to customers ───────────────────────────
console.log("\n8. Shipment linkage");
{
  const { count: shipments } = await sb.from("shipments").select("id", { count: "exact", head: true });
  const { count: links } = await sb.from("shipment_sub_orders").select("shipment_id", { count: "exact", head: true });
  console.log(`  INFO  ${shipments ?? 0} shipments, ${links ?? 0} order links`);
  if ((links ?? 0) === 0) {
    console.log("        No shipment has orders attached yet, so no customer would be notified.");
    console.log("        Orders are attached when a shipment is created, or on the shipment page.");
  }
}

console.log(failures === 0
  ? "\nALL CHECKS PASSED — the chain is connected end to end\n"
  : `\n${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
