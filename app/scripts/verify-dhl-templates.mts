/**
 * Reads back each DHL template from Twilio and asserts it byte-matches
 * MESSAGE_BODIES in the repo, then writes a UTF-8 file for human review
 * (Windows consoles cannot print Arabic).
 * Run: npx tsx scripts/verify-dhl-templates.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { MESSAGE_BODIES, TEMPLATE_NAMES, type CustomerMessageKey } from "../lib/shipping/dhl-customer-messages.ts";

const env = Object.fromEntries(
  readFileSync("./.env.local", "utf8").split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const auth = "Basic " + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");

const KEYS: CustomerMessageKey[] = [
  "picked_up", "usa_processing", "departed_usa", "arrived_ksa", "customs_cleared", "at_trendlet_hq",
];

const list = await (await fetch("https://content.twilio.com/v1/Content?PageSize=200", { headers: { Authorization: auth } })).json();
const bySid = new Map<string, { sid: string; body: string }>(
  (list.contents ?? []).map((c: { friendly_name: string; sid: string; types: Record<string, { body?: string }> }) =>
    [c.friendly_name, { sid: c.sid, body: c.types?.["twilio/text"]?.body ?? "" }]),
);

const out: string[] = ["TRENDLET — DHL customer messages as stored in Twilio", ""];
for (const key of KEYS) {
  const name = TEMPLATE_NAMES[key];
  const row = bySid.get(name);
  assert.ok(row, `template ${name} not found on the Twilio account`);
  assert.equal(row.body, MESSAGE_BODIES[key], `${name}: Twilio body differs from the repo`);
  out.push("=".repeat(64), `${key}   [${name}]   ${row.sid}`, "", row.body, "");
}

writeFileSync("dhl-templates-review.txt", out.join("\n"), "utf8");
console.log(`ok — all ${KEYS.length} templates match the repo exactly`);
console.log("wrote dhl-templates-review.txt (UTF-8) for reading");
