/**
 * Seed pricing_rules table from تفصيل_الرسوم_للمبرمج.xlsx
 *
 * Run from app/ directory:
 *   node scripts/seed-pricing-rules.mjs --file "path/to/تفصيل_الرسوم_للمبرمج.xlsx"
 *
 * Idempotent — upserts on (brand_name, category_ar, gender) conflict.
 * After seeding, manually add shopify_product_type_alias values for any
 * Shopify product_type strings that don't exactly match category_ar.
 *
 * Known alias pre-populated by this script:
 *   category_ar "علاقات شنط وميداليات" ← shopify alias "تعليقات شنط"
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";
import * as XLSX from "xlsx";

// ── Load env ──────────────────────────────────────────────────────────────────
const envPath = join(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);

const url        = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

// ── Parse args ────────────────────────────────────────────────────────────────
const fileArg = process.argv.indexOf("--file");
if (fileArg === -1 || !process.argv[fileArg + 1]) {
  console.error("Usage: node scripts/seed-pricing-rules.mjs --file <path-to-xlsx>");
  process.exit(1);
}
const xlsxPath = process.argv[fileArg + 1];

// ── Parse Excel ───────────────────────────────────────────────────────────────
const workbook  = XLSX.readFile(xlsxPath);
const sheet     = workbook.Sheets["كل الفئات"];
if (!sheet) {
  console.error('Sheet "كل الفئات" not found in workbook');
  process.exit(1);
}

const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

const VALID_GENDERS = new Set(["نسائي", "رجالي", "أطفال"]);

let currentBrand = null;
const rows = [];

for (let i = 0; i < raw.length; i++) {
  const row = raw[i];
  const col0 = String(row[0] ?? "").trim();

  // Brand header row
  if (col0.includes("▶") && row[2] == null) {
    currentBrand = col0.replace("▶", "").trim();
    continue;
  }

  // Skip spreadsheet header row
  if (row[1] === "البراند") continue;

  // Data row: col0 is a number
  const sourceRow = parseInt(col0, 10);
  if (isNaN(sourceRow) || !currentBrand) continue;

  const category = String(row[2] ?? "").trim();
  const gender   = VALID_GENDERS.has(String(row[3] ?? "")) ? String(row[3]) : null;

  const svcVat = parseFloat(row[5]);
  const svcNet = parseFloat(row[6]);
  const svcTax = parseFloat(row[7]);
  const ship   = parseFloat(row[8]);

  if (!category || isNaN(svcVat) || isNaN(ship)) continue;

  rows.push({
    brand_name:           currentBrand,
    category_ar:          category,
    gender,
    service_fee_with_vat: svcVat,
    service_fee_net:      svcNet,
    service_fee_vat:      svcTax,
    shipping_customs_fee: ship,
    source_row:           sourceRow,
  });
}

console.log(`Parsed ${rows.length} rows from Excel`);

// ── Upsert in batches ─────────────────────────────────────────────────────────
const BATCH = 100;
let upserted = 0;

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const { error } = await sb.from("pricing_rules").upsert(batch, {
    onConflict: "brand_name,category_ar,gender",
  });
  if (error) {
    console.error(`Batch ${i / BATCH} failed:`, error.message);
    process.exit(1);
  }
  upserted += batch.length;
  process.stdout.write(`\rUpserted ${upserted}/${rows.length}...`);
}

console.log(`\nDone. ${upserted} rows seeded.`);

// ── Set known alias ───────────────────────────────────────────────────────────
const { error: aliasErr } = await sb
  .from("pricing_rules")
  .update({ shopify_product_type_alias: "تعليقات شنط" })
  .eq("category_ar", "علاقات شنط وميداليات");

if (aliasErr) {
  console.warn("Alias update failed:", aliasErr.message);
} else {
  console.log('Alias set: "علاقات شنط وميداليات" ← "تعليقات شنط"');
}
