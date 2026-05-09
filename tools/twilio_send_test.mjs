// tools/twilio_send_test.mjs
// One-shot: send the under_review Arabic template to a target Saudi number.
// Reads creds from app/.env.local. Prints Twilio response.
// Usage: node tools/twilio_send_test.mjs

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(here, "..", "app", ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
    }),
);

const accountSid = env.TWILIO_ACCOUNT_SID;
const authToken = env.TWILIO_AUTH_TOKEN;
const from = env.TWILIO_WHATSAPP_FROM;
if (!accountSid || !authToken || !from) {
  console.error("Missing TWILIO_* in app/.env.local");
  process.exit(1);
}

// Hardcoded for this single test only
const to = "+966507878156";
const contentSid = "HX864cc4f3ea78bc36040ba476ba3e62e5"; // under_review
const variables = JSON.stringify({ "1": "TEST-001", "2": "Romy Bucket Bag" });

const params = new URLSearchParams();
params.set("To", `whatsapp:${to}`);
params.set("From", from);
params.set("ContentSid", contentSid);
params.set("ContentVariables", variables);

const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
const r = await fetch(
  `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
  {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  },
);

const j = await r.json();
console.log("HTTP", r.status);
console.log(JSON.stringify(j, null, 2));
