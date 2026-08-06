/**
 * Syncs the Twilio content templates for DHL shipment-status messages from
 * MESSAGE_BODIES, so the repo stays the source of truth.
 *
 *   npx tsx scripts/create-dhl-templates.mts            # create/refresh drafts
 *   npx tsx scripts/create-dhl-templates.mts --submit   # + submit to Meta
 *
 * Creating a draft is free and reversible. SUBMITTING starts a Meta review
 * that takes days and cannot be edited mid-flight, so it is behind the flag.
 *
 * Twilio content templates are immutable, so a body change means deleting and
 * recreating. Only ever deletes UNSUBMITTED templates — an approved one is
 * left alone and reported, since deleting it would throw away the approval.
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

const KEYS: CustomerMessageKey[] = [
  "picked_up", "usa_processing", "departed_usa", "arrived_ksa", "customs_cleared", "at_trendlet_hq",
  "delay_after_customs", "delay_3days",
];

/** {{1}}, {{2}} … -> the sample values Twilio shows in previews. */
const VARIABLES = { "1": "1535-01", "2": "Tory Burch Britten Micro Satchel" };

const jf = async (url: string, init?: RequestInit) => {
  const r = await fetch(url, { ...init, headers: { Authorization: auth, ...(init?.headers ?? {}) } });
  return { ok: r.ok, status: r.status, body: r.status === 204 ? {} : await r.json() };
};

const list = await jf("https://content.twilio.com/v1/Content?PageSize=200");
const existing = new Map<string, { sid: string; body: string }>(
  (list.body.contents ?? []).map((c: { friendly_name: string; sid: string; types: Record<string, { body?: string }> }) =>
    [c.friendly_name, { sid: c.sid, body: c.types?.["twilio/text"]?.body ?? "" }]),
);

const results: { name: string; sid: string; state: string }[] = [];

for (const key of KEYS) {
  const name = TEMPLATE_NAMES[key];
  const want = MESSAGE_BODIES[key];
  const cur = existing.get(name);

  if (cur && cur.body === want) {
    results.push({ name, sid: cur.sid, state: "up to date" });
  } else {
    if (cur) {
      // Refuse to destroy an approval.
      const ar = await jf(`https://content.twilio.com/v1/Content/${cur.sid}/ApprovalRequests`);
      const status = ar.body?.whatsapp?.status ?? "unsubmitted";
      if (status !== "unsubmitted") {
        results.push({ name, sid: cur.sid, state: `SKIPPED — already ${status}, body differs` });
        continue;
      }
      await jf(`https://content.twilio.com/v1/Content/${cur.sid}`, { method: "DELETE" });
    }
    const created = await jf("https://content.twilio.com/v1/Content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        friendly_name: name,
        language: "ar",
        types: { "twilio/text": { body: want } },
        variables: VARIABLES,
      }),
    });
    if (!created.ok) {
      console.error(`  FAILED ${name}: ${created.status} ${JSON.stringify(created.body).slice(0, 200)}`);
      continue;
    }
    results.push({ name, sid: created.body.sid, state: cur ? "recreated" : "created" });
  }

  if (submit) {
    const row = results[results.length - 1];
    if (row.state.startsWith("SKIPPED")) continue;
    const ar = await jf(`https://content.twilio.com/v1/Content/${row.sid}/ApprovalRequests/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category: "UTILITY" }),
    });
    row.state += ar.ok ? ` · submitted (${ar.body?.status ?? "pending"})` : ` · submit failed: ${JSON.stringify(ar.body).slice(0, 120)}`;
  }
}

console.log("TEMPLATE NAME             SID                                   STATE");
for (const r of results) console.log(`${r.name.padEnd(25)} ${r.sid} ${r.state}`);
if (!submit) console.log("\nDrafts only — re-run with --submit to send them to Meta.");
