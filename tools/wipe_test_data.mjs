// Delete all test/seed data from Trendslet, keeping only real Shopify orders.
//
// Targets:
//   - orders         where shopify_order_id LIKE 'mock-%' OR LIKE 'TEST-%'
//   - sub_orders     attached to those orders
//   - customers      where shopify_customer_id LIKE 'mock-%' OR LIKE 'TEST-%'
//   - activity_log   where sub_order_id ∈ test sub_orders
//   - notifications  where sub_order_id ∈ test sub_orders
//
// Deletes children first to satisfy FKs. Idempotent — re-running deletes nothing
// after a clean wipe. Runs in DRY-RUN mode unless --commit is passed.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "..", "app", ".env.local");

function loadEnv(p) {
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = loadEnv(ENV_PATH);
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const COMMIT = process.argv.includes("--commit");

const H = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function get(p) {
  const r = await fetch(`${SUPA_URL}/rest/v1${p}`, { headers: H });
  if (!r.ok) throw new Error(`GET ${p} -> ${r.status} ${await r.text()}`);
  return r.json();
}
async function del(p) {
  if (!COMMIT) return { dryRun: true, path: p };
  const r = await fetch(`${SUPA_URL}/rest/v1${p}`, { method: "DELETE", headers: H });
  if (!r.ok) throw new Error(`DELETE ${p} -> ${r.status} ${await r.text()}`);
  return r.json();
}

function inList(ids) {
  return `(${ids.map((x) => `"${x}"`).join(",")})`;
}

async function main() {
  console.log(COMMIT ? "*** COMMIT MODE — deletes will execute ***" : "DRY-RUN (pass --commit to execute)");

  // 1. test orders
  const testOrders = await get(
    "/orders?select=id,shopify_order_id&or=(shopify_order_id.like.mock-*,shopify_order_id.like.TEST-*)",
  );
  console.log(`Test orders to delete: ${testOrders.length}`);
  const orderIds = testOrders.map((o) => o.id);

  // 2. sub_orders attached to those orders
  let subIds = [];
  if (orderIds.length) {
    const subs = await get(`/sub_orders?select=id&order_id=in.${inList(orderIds)}`);
    subIds = subs.map((s) => s.id);
  }
  console.log(`Test sub_orders to delete: ${subIds.length}`);

  // 3. activity_log + notifications on those sub_orders / orders (polymorphic resource_type/resource_id)
  let alCount = 0;
  let notifCount = 0;
  const allResIds = [...subIds, ...orderIds];
  if (allResIds.length) {
    const al = await get(`/activity_log?select=id&resource_id=in.${inList(allResIds)}`);
    alCount = al.length;
    const notif = await get(`/notifications?select=id&resource_id=in.${inList(allResIds)}`);
    notifCount = notif.length;
  }
  console.log(`activity_log rows on test resources: ${alCount}`);
  console.log(`notifications rows on test resources: ${notifCount}`);

  // 4. test customers
  const testCust = await get(
    "/customers?select=id,shopify_customer_id&or=(shopify_customer_id.like.mock-*,shopify_customer_id.like.TEST-*)",
  );
  console.log(`Test customers to delete: ${testCust.length}`);

  if (!COMMIT) {
    console.log("\nDRY-RUN complete. Re-run with --commit to delete.");
    return;
  }

  // Execute deletes (children first)
  if (allResIds.length) {
    await del(`/activity_log?resource_id=in.${inList(allResIds)}`);
    console.log("✓ activity_log deleted");
    await del(`/notifications?resource_id=in.${inList(allResIds)}`);
    console.log("✓ notifications deleted");
  }
  if (subIds.length) {
    await del(`/sub_orders?id=in.${inList(subIds)}`);
    console.log("✓ sub_orders deleted");
  }
  if (orderIds.length) {
    await del(`/orders?id=in.${inList(orderIds)}`);
    console.log("✓ orders deleted");
  }
  if (testCust.length) {
    const custIds = testCust.map((c) => c.id);
    await del(`/customers?id=in.${inList(custIds)}`);
    console.log("✓ customers deleted");
  }

  console.log("\nWipe complete.");
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
