# How to resume this build in a new Claude Code window

Paste this into the new chat as the first message:

---

Resume the Trendlet Optify OMS project. All numbered phases from the
original spec are SHIPPED. The remaining work is operational
(smoke-testing, env vars, launch cleanup) — not new features.

**Read these files in order to load full context:**
1. `d:\claude code project\Trendlet\PROGRESS.md` — full history (note: may not yet include 2026-04-29 phases 4e/4f/5/6/team — verify against git log)
2. `d:\claude code project\Trendlet\CLAUDE.md` — project rules (WAT framework, edit policy, 95% confidence, Karpathy principles)
3. `d:\claude code project\Trendlet\OPTIFY_SYSTEM_PROMPT.md` — full spec
4. This file — current deployment state

**Current state (end of 2026-04-29 session):**
- ✅ Live at https://trendlet.vercel.app
- ✅ HEAD commit `7ab2f5a` (8 commits today after 090b11b)
- ✅ All numbered phases shipped: 4e (upload), 4f (AI extract + map + drafts), 5 (Zoho inbound polling), 6 (barcode), admin team page
- ✅ All 3 role views: fulfiller `/fulfillment`, warehouse `/pipeline`, sourcing `/queue`
- ✅ Admin pages: `/admin/brands`, `/admin/invoice-settings` (model picker + Zoho poll-now), `/admin/team` (invite/activate)
- ✅ Customer invoice flow Phases 0–3: review UI, PDF generator, Zoho Mail outbound (mock-mode)
- ✅ Supabase: 28 migrations applied; JWT custom claims hook live; banned `is_admin()` removed everywhere
- 🟡 3 test accounts (fulfiller-test / sourcing-test / warehouse-test, password `Trendlet!Test2026`) — DELETE BEFORE LAUNCH
- 🟡 Test data: 4 `[TEST]`-prefixed sub-orders + 1 test customer + 1 test order — DELETE BEFORE LAUNCH (cleanup SQL in PROGRESS or chat history)
- 🟡 Live integrations still in mock mode in production:
  - `OPENROUTER_API_KEY` — confirm presence in Vercel Production scope; affects Phase 4f (AI extraction) and Phase 6 (barcode reading)
  - `ZOHO_CLIENT_ID/_SECRET/_REFRESH_TOKEN/_ACCOUNT_ID/_FROM_ADDRESS` — affects Phase 3 (outbound) and Phase 5 (inbound)

**Next session priorities (in order):**
1. End-to-end smoke test by a human as sourcing-test → upload real PDF → extract → map → create draft → admin review → send
2. Confirm Vercel env vars (OpenRouter + Zoho) are in Production scope
3. Test-data cleanup before real customers hit the system
4. Pre-launch QA: Lighthouse a11y, mobile testing
5. Open feature decisions: cancel-from-any-state UI, sync-badge accuracy

**Verify build is healthy first:**
```bash
cd "d:/claude code project/Trendlet/app"
npm run typecheck    # expect 0 errors
npm run build         # expect 26+ routes clean, no warnings
git log --oneline -10 # confirm last commit is 7ab2f5a
```

Via MCP:
```
mcp__claude_ai_Supabase__execute_sql(
  project_id="kfrjqpjprvvsibwmrqph",
  query="SELECT count(*) FROM brands"
)
```

---

## Phase highlights from 2026-04-29 session

**4e — Supplier invoice upload** (`15c7beb`)
- Drag-and-drop PDF onto a sub-order row in `/queue` or `/fulfillment`
- New table `sub_order_supplier_invoices` (junction, many-to-many)
- Service action with role gate + ownership check + magic-byte PDF check
- Warehouse role explicitly excluded

**4f — AI extraction + mapping + drafts** (`a51c86a`)
- Click green Receipt badge to open inline mapping panel
- Auto-extracts line items via OpenRouter (mock-fallback when API key missing)
- Per-item dropdown maps line item → sub-order
- "Create customer invoice drafts" computes cost / markup / VAT / total per group, writes `customer_invoices` rows in `pending_review`
- New page `/admin/invoice-settings` — admin picks OCR model from `ai_models` table

**5 — Zoho inbound polling** (`932be42`)
- Daily cron `/api/cron/poll-zoho-inbound` at 05:00 UTC
- Admin "Poll now" button + recent-imports list on `/admin/invoice-settings`
- New table `zoho_inbound_messages` (dedup tracker)
- `supplier_invoices.uploaded_by` made nullable for `source != 'manual'` rows

**6 — AI barcode reading** (`d6b92bb`)
- Vision-model prompt explicitly asks for human-readable digits under barcode bars
- `validateBarcode()` rejects obvious hallucinations (length 6–30, no all-zeros)
- Mapping panel header surfaces the read barcode

**Admin team page** (`440385d`)
- `/admin/team` — invite (Supabase `inviteUserByEmail`), activate/deactivate, pending invitations list
- Self-deactivation guard

**P0 fixes applied along the way:**
- `enforce_status_whitelist` trigger was silently rejecting every status update (required `status_changed_by` no code set). Now auto-fills from `auth.uid()` and uses `jwt_is_admin()`.
- `uploadSupplierInvoiceAction` had no ownership check — fixed.
- All banned `is_admin()` calls in storage policies replaced with `jwt_is_admin()`.

---

## Key infrastructure to know about

**Shared queue fetcher**: `app/lib/queries/fulfillment.ts` → `fetchFulfillmentQueue({ region, userId, isAdmin, assigneeFilter })`. Used by all 3 role views. Region filter is now SQL-side (inner join on brands).

**Shared row component**: `app/app/(app)/fulfillment/sub-order-row.tsx` → `<SubOrderRow>`. Imported by `/pipeline` and `/queue` from the fulfillment route group. `useOptimistic` for instant feedback. Status buttons filtered by role whitelist. Now also renders the dropzone (4e) and badge-toggled mapping panel (4f) when `canUploadReceipt` prop is true.

**Shared status action**: `app/app/(app)/fulfillment/actions.ts` → `setSubOrderStatusAction()`. Revalidates all 3 view paths.

**Status state machine**: `app/lib/workflow/sub-order-transitions.ts` → `getNextStatuses(currentStatus, role, whitelist)`. Drives which buttons render.

**Role whitelist**: `app/lib/constants.ts` → `ROLE_STATUS_WHITELIST`. DB is source of truth via `enforce_status_whitelist` trigger.

**OCR/extraction service**: `app/lib/integrations/openrouter-extract.ts` — mock-fallback when `OPENROUTER_API_KEY` unset.

**Zoho inbound service**: `app/lib/integrations/zoho-mail-inbound.ts` + `app/lib/services/process-zoho-inbound.ts` (shared between cron and admin button).

## Test accounts in production Supabase (DELETE BEFORE LAUNCH)

| email | role | password |
|---|---|---|
| `ai@trendlet.com` | admin | (your password) |
| `fulfiller-test@trendlet.com` | fulfiller | `Trendlet!Test2026` |
| `sourcing-test@trendlet.com` | sourcing | `Trendlet!Test2026` |
| `warehouse-test@trendlet.com` | warehouse | `Trendlet!Test2026` |

Seed script: `app/scripts/seed-test-users.mjs` — idempotent.

## Test-data cleanup SQL (run before launch)

```sql
DELETE FROM sub_orders WHERE product_title LIKE '[TEST]%';
DELETE FROM orders WHERE shopify_order_number LIKE '[TEST]%';
DELETE FROM customers WHERE first_name LIKE '[TEST]%';
DELETE FROM brand_assignments
  WHERE user_id IN (
    '24f4ef25-8251-4016-a8ef-e14a851c0a3f',
    '8982f43b-ded5-4f06-b047-6a708f53d8ef'
  )
  AND brand_id IN (
    '0836a7ed-b4df-4613-9553-c71af58b7ff5',
    '60a13acc-edb3-49db-b2c1-e30af91b3632'
  );
-- Plus: delete uploaded test PDFs from supplier-invoices bucket and any
-- supplier_invoices/customer_invoices rows generated during smoke testing.
```

## Active git config in this repo
- author: `ai-4275 <ai@trendlet.com>` (Vercel Hobby plan requires project-member commit author)
- remote: `https://github.com/trendlet-almateri/trendlet.git`
- gh CLI authenticated as `trendlet-almateri`
- main branch protected by Vercel auto-deploy

## Vercel-specific gotchas
- Hobby plan: only daily crons. `vercel.json` has `pull-hubstaff` at 04:00 UTC + `poll-zoho-inbound` at 05:00 UTC.
- Hobby plan: blocks deploys whose commit author isn't a project member. Always commit as `ai@trendlet.com`.
- Edge runtime middleware can't import `@supabase/ssr` — auth gating lives in server-component layouts.
- Project is behind Vercel SSO (Deployment Protection ON) — public visitors see 401 until they sign in to Vercel.

## What NOT to do (per project "do not" rules)
- Don't run paid scripts without confirmation
- Don't add a Settings page in sidebar (settings live in user dropdown / page-level)
- Don't commit `.env.local`
- Don't write back to Shopify (read-only integration)
- Don't use `is_admin()` in RLS — use `jwt_is_admin()`
- Don't change git author away from `ai@trendlet.com` in this repo
- Don't include "fulfiller" in role lists for `/queue` or `/pipeline`

## Open items still parked (not blocking, feature decisions)
- Cancel-from-any-state UI mentioned in `lib/workflow/sub-order-transitions.ts` comments but never built
- "Synced 2 min ago" sync badge is hardcoded on dashboard + invoice list
- `getCurrentUser` JWT fast-path: design intended a JWT claim read but falls back to a service-role DB lookup; perf-only, works correctly
- Lighthouse a11y sweep — deferred to final test pass before launch
- Real Shopify webhook firing at production URL — not yet, currently only `[TEST]` seed data
