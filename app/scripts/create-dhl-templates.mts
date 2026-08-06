/**
 * Creates the Twilio content templates for the DHL shipment-status messages
 * from MESSAGE_BODIES, so the repo stays the source of truth.
 *
 *   npx tsx scripts/create-dhl-templates.mts            # create drafts only
 *   npx tsx scripts/create-dhl-templates.mts --submit   # + submit to Meta
 *
 * Creating a draft is free and reversible. SUBMITTING starts a Meta review
 * that takes days and cannot be edited mid-flight, so it is behind the flag —
 * check the Arabic renders correctly before submitting.
 *
 * Idempotent: skips any template whose friendly_name already exists.
 */
import { readFileSync } from "node:fs";
import { MESSAGE_BODIES, TEMPLATE_NAMES, type CustomerMessageKey } from "../lib/shipping/dhl-customer-messages.ts";

const env = Object.fromEntries(
  readFileSync("./.env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const auth = "Basic " + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
const submit = process.argv.includes("--submit");

// Only the six that fire on a normal delivery; the two delay templates are
// created once the delay path is wired.
const KEYS: CustomerMessageKey[] = [
  "picked_up", "usa_processing", "departed_usa", "arrived_ksa", "customs_cleared", "at_trendlet_hq",
];

const listRes = await fetch("https://content.twilio.com/v1/Content?PageSize=200", { headers: { Authorization: auth } });
const existing = new Map<string, string>(
  ((await listRes.json()).contents ?? []).map((c: { friendly_name: string; sid: string }) => [c.friendly_name, c.sid]),
);
console.log(`${existing.size} templates already on the account\n`);

const results: { key: string; name: string; sid: string; state: string }[] = [];

for (const key of KEYS) {
  const name = TEMPLATE_NAMES[key];
  let sid = existing.get(name);

  if (sid) {
    results.push({ key, name, sid, state: "already existed" });
  } else {
    const res = await fetch("https://content.twilio.com/v1/Content", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        friendly_name: name,
        language: "ar",
        types: { "twilio/text": { body: MESSAGE_BODIES[key] } },
        variables: {},
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      console.error(`  FAILED ${name}: ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
      continue;
    }
    sid = body.sid as string;
    results.push({ key, name, sid, state: "created" });
  }

  if (submit && sid) {
    const ar = await fetch(`https://content.twilio.com/v1/Content/${sid}/ApprovalRequests/whatsapp`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name, category: "UTILITY" }),
    });
    const arBody = await ar.json();
    const row = results[results.length - 1];
    row.state = ar.ok ? `submitted (${arBody?.status ?? "pending"})` : `submit failed: ${JSON.stringify(arBody).slice(0, 120)}`;
  }
}

console.log("KEY                  TEMPLATE NAME             SID                                   STATE");
for (const r of results) {
  console.log(`${r.key.padEnd(20)} ${r.name.padEnd(25)} ${r.sid} ${r.state}`);
}
if (!submit) console.log("\nDrafts only — re-run with --submit to send them to Meta for approval.");
