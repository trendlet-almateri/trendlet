// Run live read-only health pings against every external integration declared
// in app/.env.local. Read-only, no messages sent, no AI tokens spent.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "..", "app", ".env.local");

function loadEnv(p) {
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const env = loadEnv(ENV_PATH);

const results = [];
function record(service, status, detail) {
  results.push({ service, status, detail });
}

async function checkSupabase() {
  const t0 = Date.now();
  try {
    const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/statuses?select=key&limit=1`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!r.ok) return record("supabase", "error", `HTTP ${r.status}`);
    record("supabase", "ok", `service-role + RLS reachable (${Date.now() - t0}ms)`);
  } catch (e) {
    record("supabase", "error", e.message);
  }
}

async function checkShopify() {
  if (!env.SHOPIFY_ACCESS_TOKEN || !env.SHOPIFY_SHOP_DOMAIN)
    return record("shopify", "missing", "missing token or shop domain");
  const r = await fetch(`https://${env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-10/shop.json`, {
    headers: { "X-Shopify-Access-Token": env.SHOPIFY_ACCESS_TOKEN, Accept: "application/json" },
  });
  if (r.status === 401 || r.status === 403) return record("shopify", "auth_failed", `HTTP ${r.status}`);
  if (!r.ok) return record("shopify", "error", `HTTP ${r.status}`);
  const j = await r.json();
  record("shopify", "ok", `connected to ${j.shop?.name ?? "unknown"} (${j.shop?.myshopify_domain})`);
}

async function checkTwilio() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return record("twilio", "missing", "missing SID or token");
  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}.json`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });
  if (r.status === 401) return record("twilio", "auth_failed", "HTTP 401");
  if (!r.ok) return record("twilio", "error", `HTTP ${r.status}`);
  const j = await r.json();
  record("twilio", "ok", `account ${j.status} · friendly_name=${j.friendly_name}`);
}

async function checkOpenAi() {
  if (!env.OPENAI_API_KEY) return record("openai", "missing", "OPENAI_API_KEY not set");
  const r = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, Accept: "application/json" },
  });
  if (r.status === 401) return record("openai", "auth_failed", "HTTP 401");
  if (!r.ok) return record("openai", "error", `HTTP ${r.status}`);
  const j = await r.json();
  record("openai", "ok", `${(j.data ?? []).length} models available`);
}

async function checkOpenRouter() {
  if (!env.OPENROUTER_API_KEY) return record("openrouter", "missing", "OPENROUTER_API_KEY not set");
  const base = env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
  const r = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, Accept: "application/json" },
  });
  if (r.status === 401) return record("openrouter", "auth_failed", "HTTP 401");
  if (!r.ok) return record("openrouter", "error", `HTTP ${r.status}`);
  const j = await r.json();
  record("openrouter", "ok", `${(j.data ?? []).length} models available`);
}

async function checkDhl() {
  if (!env.DHL_API_KEY) return record("dhl", "missing", "DHL_API_KEY not set");
  record("dhl", "skipped", "credentials present; no safe ping endpoint");
}

async function checkHubstaff() {
  if (!env.HUBSTAFF_TOKEN) return record("hubstaff", "missing", "HUBSTAFF_TOKEN not set");
  const r = await fetch("https://api.hubstaff.com/v2/users/me", {
    headers: { Authorization: `Bearer ${env.HUBSTAFF_TOKEN}`, Accept: "application/json" },
  });
  if (r.status === 401) return record("hubstaff", "auth_failed", "HTTP 401");
  if (!r.ok) return record("hubstaff", "error", `HTTP ${r.status}`);
  const j = await r.json();
  record("hubstaff", "ok", `connected as ${j.user?.name ?? "unknown"}`);
}

async function checkResend() {
  if (!env.RESEND_API_KEY) return record("resend", "missing", "RESEND_API_KEY not set");
  const r = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, Accept: "application/json" },
  });
  if (r.status === 401) return record("resend", "auth_failed", "HTTP 401");
  if (!r.ok) return record("resend", "error", `HTTP ${r.status}`);
  const j = await r.json();
  record("resend", "ok", `${(j.data ?? []).length} domains configured`);
}

async function checkZoho() {
  const missing = [];
  for (const k of ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN", "ZOHO_ACCOUNT_ID", "ZOHO_FROM_ADDRESS"])
    if (!env[k]) missing.push(k);
  if (missing.length) return record("zoho", "missing", `Missing: ${missing.join(", ")}`);
  const params = new URLSearchParams({
    refresh_token: env.ZOHO_REFRESH_TOKEN,
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });
  const r = await fetch(`https://accounts.zoho.com/oauth/v2/token?${params}`, { method: "POST" });
  if (r.status === 400 || r.status === 401) return record("zoho", "auth_failed", `HTTP ${r.status}`);
  if (!r.ok) return record("zoho", "error", `HTTP ${r.status}`);
  record("zoho", "ok", `mailbox ${env.ZOHO_FROM_ADDRESS} ready`);
}

async function checkVercel() {
  if (!env.vercel_apikey) return record("vercel", "missing", "vercel_apikey not set");
  const r = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${env.vercel_apikey}` },
  });
  if (r.status === 401) return record("vercel", "auth_failed", "HTTP 401");
  if (!r.ok) return record("vercel", "error", `HTTP ${r.status}`);
  const j = await r.json();
  record("vercel", "ok", `user=${j.user?.username ?? j.user?.email ?? "unknown"}`);
}

async function checkGithub() {
  if (!env.github_token) return record("github", "missing", "github_token not set");
  const r = await fetch("https://api.github.com/repos/trendlet-almateri/trendlet/commits?per_page=1", {
    headers: { Authorization: `Bearer ${env.github_token}`, Accept: "application/vnd.github+json" },
  });
  if (r.status === 401) return record("github", "auth_failed", "HTTP 401");
  if (!r.ok) return record("github", "error", `HTTP ${r.status}`);
  const j = await r.json();
  const c = Array.isArray(j) ? j[0] : null;
  record("github", "ok", `latest=${c?.sha?.slice(0, 7)} ${c?.commit?.author?.date} '${c?.commit?.message?.split("\n")[0]?.slice(0, 60)}'`);
}

const checks = [checkSupabase, checkShopify, checkTwilio, checkOpenAi, checkOpenRouter, checkDhl, checkHubstaff, checkResend, checkZoho, checkVercel, checkGithub];
await Promise.all(checks.map((c) => c().catch((e) => record(c.name.replace(/^check/, "").toLowerCase(), "error", e.message))));

const pad = (s, n) => String(s).padEnd(n, " ");
console.log(`${pad("SERVICE", 12)}  ${pad("STATUS", 12)}  DETAIL`);
console.log("-".repeat(80));
for (const r of results) {
  const icon = r.status === "ok" ? "✓" : r.status === "missing" ? "○" : r.status === "skipped" ? "·" : "✗";
  console.log(`${icon} ${pad(r.service, 10)}  ${pad(r.status, 12)}  ${r.detail}`);
}
