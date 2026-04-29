// One-off: create three test employee accounts in live Supabase Auth + assign
// roles + ensure profile rows.
//
// Run from app/ directory:
//   node scripts/seed-test-users.mjs
//
// Idempotent — re-running is safe (it skips users that already exist by email).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// --- load env from .env.local without dotenv dep ----------------------------
const envText = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "Trendlet!Test2026";

const USERS = [
  {
    email: "fulfiller-test@trendlet.com",
    full_name: "Test Fulfiller (EU)",
    region: "EU",
    role: "fulfiller",
  },
  {
    email: "sourcing-test@trendlet.com",
    full_name: "Test Sourcing (US)",
    region: "US",
    role: "sourcing",
  },
  {
    email: "warehouse-test@trendlet.com",
    full_name: "Test Warehouse (US)",
    region: "US",
    role: "warehouse",
  },
];

async function findUserByEmail(email) {
  // listUsers paginates; we have ~4 users total, so the first page is enough.
  const { data, error } = await sb.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function ensureUser(spec) {
  const existing = await findUserByEmail(spec.email);
  let userId;

  if (existing) {
    userId = existing.id;
    console.log(`  user exists: ${spec.email} → ${userId}`);
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email: spec.email,
      password: PASSWORD,
      email_confirm: true, // skip the email confirmation flow for test users
    });
    if (error) throw new Error(`createUser ${spec.email}: ${error.message}`);
    userId = data.user.id;
    console.log(`  user created: ${spec.email} → ${userId}`);
  }

  // Profile row (upsert — won't duplicate)
  const { error: pErr } = await sb.from("profiles").upsert(
    {
      id: userId,
      email: spec.email,
      full_name: spec.full_name,
      region: spec.region,
      is_active: true,
    },
    { onConflict: "id" },
  );
  if (pErr) throw new Error(`profile ${spec.email}: ${pErr.message}`);

  // Role row (upsert via composite key — table has UNIQUE on user_id+role)
  const { error: rErr } = await sb
    .from("user_roles")
    .upsert(
      { user_id: userId, role: spec.role },
      { onConflict: "user_id,role" },
    );
  if (rErr) throw new Error(`user_role ${spec.email}: ${rErr.message}`);

  return userId;
}

console.log("Seeding test users…");
for (const spec of USERS) {
  console.log(`\n${spec.email} (${spec.role})`);
  try {
    await ensureUser(spec);
    console.log(`  ✓ ${spec.role} role active`);
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
    process.exitCode = 1;
  }
}

console.log("\nDone.\n");
console.log("Login credentials (all three users):");
console.log(`  password: ${PASSWORD}\n`);
for (const u of USERS) {
  console.log(`  ${u.email}  →  role: ${u.role}`);
}
