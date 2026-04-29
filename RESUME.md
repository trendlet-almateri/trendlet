# How to resume this build in a new Claude Code window

Paste this into the new chat as the first message:

---

Resume the Trendlet Optify OMS build at the start of Phase 4e (supplier invoice upload).

**Read these files in order to load full context:**
1. `d:\claude code project\Trendlet\PROGRESS.md` — full history of phases 1–7 + this session's 0–4d
2. `d:\claude code project\Trendlet\CLAUDE.md` — project rules (WAT framework, edit policy, 95% confidence, Karpathy principles)
3. `d:\claude code project\Trendlet\OPTIFY_SYSTEM_PROMPT.md` — full spec
4. This file — current deployment state

**Current state (2026-04-29 end of session):**
- ✅ Live at https://trendlet.vercel.app
- ✅ HEAD commit `090b11b` — Phase 4d shipped (sourcing view)
- ✅ All 3 role views complete: fulfiller (EU) at `/fulfillment`, warehouse (US late) at `/pipeline`, sourcing (US early) at `/queue`
- ✅ Brand admin (`/admin/brands`) — full CRUD with create + rename + region + markup + assignee
- ✅ Invoice flow Phases 0–3 complete: review actions UI, PDF generator (`@react-pdf/renderer` + `bwip-js`), Zoho Mail outbound (mock-mode-first)
- ✅ Supabase: 22 migrations applied, JWT custom claims hook live, RLS hardened
- 🟡 3 test accounts in production Auth (fulfiller-test / sourcing-test / warehouse-test, password `Trendlet!Test2026`) — DELETE BEFORE LAUNCH
- 🟡 Zoho env vars NOT set — outbound email currently no-ops (logs as 'skipped' in api_logs)

**Next phase: 4e — Supplier invoice upload**

Sourcer / fulfiller drag-and-drops a PDF receipt onto a sub-order. The PDF is stored in the existing `supplier-invoices` bucket. A `supplier_invoices` row is created and `customer_invoices.supplier_invoice_id` is linked. No AI yet — that's Phase 4f.

**Who can upload (locked):** `sourcing`, `fulfiller`, and `admin` only. Warehouse does NOT touch the PDF flow — they handle physical fulfillment status only. Sourcing uploads receipts for US brands; fulfiller uploads for EU brands; admin can do either.

Scope:
- Drag-and-drop component on the sub-order detail panel (mounted on /queue for sourcing, /fulfillment for fulfiller, NOT on /pipeline)
- Server action `uploadSupplierInvoiceAction` — `requireRole(["sourcing","fulfiller","admin"])`, service-role storage upload, MIME validation, sub-order linking
- File size limit 10MB, MIME `application/pdf` only
- Path convention: `supplier-invoices/{user_id}/{yyyy-mm}/{uuid}-{filename}`

**Phase 4f preview (next after 4e):** AI extraction (OpenRouter) reads the uploaded PDF, sourcer/fulfiller maps line items to sub-orders, clicks "Create customer invoice drafts." Drafts go to admin's `pending_review` queue. Admin approves → PDF renders (already built in Phase 2) → Zoho sends (already built in Phase 3, mock until env vars). 4f also builds the admin AI model picker at `/admin/invoice-settings` (admin-only page, choice stored in `settings` table, read by sourcing AND fulfiller's extraction calls). Manual-entry fallback when AI fails.

**Locked design decisions (do not re-ask in future sessions):**
- 3 disjoint roles: fulfiller (EU only), sourcing (US, brand-restricted), warehouse (US, sees all). KSA driver reserved for future shipping integration.
- Brand routing: `brands.region` + `brand_assignments.is_primary` drives queue routing. Unassigned brands → `/orders/unassigned`.
- Markup: per-brand only, snapshotted onto customer_invoices at draft time. Math: `item_price = cost / (1 + markup_percent/100)`.
- Barcode: ONE per supplier invoice (not per item). Reproduced verbatim on every split customer invoice. If null, PDF omits the block silently.
- AI extraction model: admin-picked from `/admin/invoice-settings` (built in 4f), stored in `settings` table.
- AI extraction failure fallback: manual data-entry form (built in 4f).
- Phase 4-team (admin user creation UI) deferred until after 4e + 4f.

**Verify build is healthy first:**
```bash
cd "d:/claude code project/Trendlet/app"
npm run typecheck    # expect 0 errors
npm run build         # expect 23 routes clean, no warnings
git log --oneline -5  # confirm last commit is 090b11b
```

Via MCP:
```
mcp__claude_ai_Supabase__execute_sql(
  project_id="kfrjqpjprvvsibwmrqph",
  query="SELECT count(*) FROM brands"
)
```
(Expected: 0 unless user has manually added brands via /admin/brands.)

---

## Key infrastructure to know about

**Shared queue fetcher**: `app/lib/queries/fulfillment.ts` → `fetchFulfillmentQueue({ region, userId, isAdmin, assigneeFilter })`. Used by all 3 role views.

**Shared row component**: `app/app/(app)/fulfillment/sub-order-row.tsx` → `<SubOrderRow>`. Imported by `/pipeline` and `/queue` from the fulfillment route group. `useOptimistic` for instant feedback. Status buttons filtered by role whitelist.

**Shared status action**: `app/app/(app)/fulfillment/actions.ts` → `setSubOrderStatusAction()`. The DB trigger `enforce_status_whitelist` is the security boundary; this action just calls `.update()` and lets RLS + the trigger gate.

**Status state machine**: `app/lib/workflow/sub-order-transitions.ts` → `getNextStatuses(currentStatus, role, whitelist)`. Drives which buttons render in each view.

**Role whitelist**: `app/lib/constants.ts` → `ROLE_STATUS_WHITELIST`. Mirrors `statuses.allowed_from_roles` in DB. DB is source of truth.

## Test accounts in production Supabase (DELETE BEFORE LAUNCH)

| email | role | password |
|---|---|---|
| `ai@trendlet.com` | admin | (your password) |
| `fulfiller-test@trendlet.com` | fulfiller | `Trendlet!Test2026` |
| `sourcing-test@trendlet.com` | sourcing | `Trendlet!Test2026` |
| `warehouse-test@trendlet.com` | warehouse | `Trendlet!Test2026` |

Seed script: `app/scripts/seed-test-users.mjs` — idempotent; re-running is safe.

## Active git config in this repo
- author: `ai-4275 <ai@trendlet.com>` (Vercel Hobby plan requires project-member commit author)
- remote: `https://github.com/trendlet-almateri/trendlet.git`
- gh CLI authenticated as `trendlet-almateri` via OS keyring
- credential helper: `gh auth setup-git` already done
- main branch protected by Vercel auto-deploy: every push to main → Vercel deploy

## Vercel-specific gotchas already learned
- Hobby plan: only daily crons. `vercel.json` is currently `0 4 * * *`.
- Hobby plan: blocks deploys whose commit author isn't a project member. Always commit as `ai@trendlet.com`.
- Edge runtime middleware can't import `@supabase/ssr` — no middleware in the repo right now (auth gating lives in server-component layouts).
- Project is behind Vercel SSO (Deployment Protection ON) — public visitors see 401 until they sign in to Vercel.

## What NOT to do (per PROGRESS.md "do not" rules)
- Don't run paid scripts without confirmation
- Don't add a Settings page in sidebar (settings live in the user dropdown / page-level settings)
- Don't commit `.env.local`
- Don't write back to Shopify (read-only integration)
- Don't use `is_admin()` in RLS — use `jwt_is_admin()`
- Don't change git author away from `ai@trendlet.com` in this repo
- Don't include "fulfiller" in role lists for `/queue` or `/pipeline` (those are US-only roles now; fulfiller has its own `/fulfillment`)

## Open items still parked (not blocking)
- `markup_percent` storage format on existing seeded brands — should default 0; admin sets per-brand via `/admin/brands`
- Admin AI model picker UI — Phase 4f
- `activity_log` writes on invoice actions — nice-to-have audit trail, not yet wired
- "Synced 2 min ago" sync badge is hardcoded on dashboard + invoice list
- Lighthouse a11y sweep — deferred to final test pass before launch
- Phase 5+ (Zoho inbound polling, AI barcode-from-image) — not started
