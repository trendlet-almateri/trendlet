// tools/twilio_fetch_templates.mjs
// Read-only: fetch the body of each Twilio Content Template (HX SID)
// so we can match each SID to the correct sub-order status.
//
// Usage: node tools/twilio_fetch_templates.mjs
// Reads TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN from app/.env.local.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "..", "app", ".env.local");

const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
    }),
);

const accountSid = env.TWILIO_ACCOUNT_SID;
const authToken = env.TWILIO_AUTH_TOKEN;
if (!accountSid || !authToken) {
  console.error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in app/.env.local");
  process.exit(1);
}

const SIDS = [
  "HX864cc4f3ea78bc36040ba476ba3e62e5",
  "HXb05208e5a0fafd09d5943dcda7dd0d45",
  "HXda7be5e1f9eec8e4929573b4671d5c15",
  "HXe9292a1b1713fdf4eb023aa0a2c8ae21",
  "HX329959132816310be54b48524a24cefd",
  "HX177984255ec5f0a67ed6add555dd16af",
  "HX250c16c81704b3ab496f53bab4543c84",
  "HXf9b177f834b7de0593b47c757920c8cb",
];

const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

function bodyFromTypes(types) {
  if (!types) return null;
  const t = types["twilio/text"] ?? types["twilio/quick-reply"] ?? types["twilio/call-to-action"] ?? types["twilio/card"];
  if (!t) return Object.keys(types).join(", ") + " (non-text)";
  return t.body ?? JSON.stringify(t).slice(0, 400);
}

for (const sid of SIDS) {
  const r = await fetch(`https://content.twilio.com/v1/Content/${sid}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!r.ok) {
    console.log(`\n=== ${sid} ===\nERROR ${r.status}: ${await r.text()}`);
    continue;
  }
  const j = await r.json();
  console.log(`\n=== ${sid} ===`);
  console.log(`friendly_name: ${j.friendly_name ?? ""}`);
  console.log(`language:      ${j.language ?? ""}`);
  console.log(`body:\n${bodyFromTypes(j.types)}`);
}
