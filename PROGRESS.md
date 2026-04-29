# Optify OMS — Build Progress

> **Single source of truth for resuming this build in a new session.** Read this first.

**Project:** Optify OMS for Trendslet (full v2.0 build per `Trendlet/OPTIFY_SYSTEM_PROMPT.md`)
**App location:** `d:\claude code project\Trendlet\app\` (Next.js 14 + TS + Tailwind)
**Supabase project:** `kfrjqpjprvvsibwmrqph` ("Trendlet", eu-west-1, Postgres 17)
**Started:** 2026-04-27
**Last updated:** 2026-04-27 (Phase 4 — admin pages partial)

---

## Current state

**Phase 1 (foundation):** ✅ Complete
**Phase 2 (database):** ✅ All 17 migrations applied to Supabase. Manual blockers resolved.
**Phase 3 (auth + shell):** ✅ Complete. Login, forgot-password, setup, sidebar, utility bar, user dropdown, mobile bottom nav. Admin user `ai@trendlet.com` (Mohammed Almateri) ready.
**Phase 4 (admin pages):** ✅ Complete. **Mock data seeded** (40 orders / 58 sub-orders / 25 KSA customers / 6 brands / 19 activity log entries). All 13 admin + employee pages built: `/dashboard`, `/orders`, `/orders/[id]`, `/orders/unassigned`, `/invoices`, `/invoices/[id]`, `/activity-log`, `/sla-health`, `/team-load`, `/payroll`, `/shipments`, `/returns`, `/reports`, `/queue`, `/pipeline`, `/eu-fulfillment`, `/deliveries`. Production build clean — 21 routes total.
**Phase 5 (interactive shell + offline):** ✅ Complete. Notifications panel (Realtime), ⌘K command palette, KSA delivery actions with offline queue (IndexedDB) + service worker. 21 routes still compile clean.
**Phase 6 (integrations):** ✅ Code-complete. Centralized API client + 5 service modules (Shopify webhook, Twilio WhatsApp, Hubstaff, DHL, Resend). 23 routes now (added 2 API endpoints). All mocks in place; live paths gated by env vars. **Not yet exercised end-to-end** — needs CRON_SECRET set, Shopify webhook URL registered, Twilio template SIDs pasted. See "Phase 6" section below for the activation checklist.
**Phase 7 (production polish):** 🟡 Partial. `vercel.json` cron registered, "Sync now" button on /payroll, `/setup/integrations` health-check page wired (the previously-dead user-dropdown link). Items deferred to final test pass: Lighthouse + a11y sweep (browser-bound), spec §15 production checklist walkthrough, status-change UI wiring for sourcing/warehouse (those UIs don't exist yet).

### Live credential status (captured 2026-04-28 via the new health-check page)
| Service | Status | Notes |
|---|---|---|
| Supabase | 🟢 OK | service-role + RLS reachable |
| Shopify | 🔴 **Auth failed** | HTTP 401 `Invalid API key or access token` — **same dead token from Phase 4 mock-data fallback. Needs rotation in Shopify Admin → Apps → Develop apps before webhook ingestion will work for outbound calls.** Note: webhook RECEIVE doesn't need this token — it uses `SHOPIFY_WEBHOOK_SECRET` for HMAC verify. |
| Twilio | 🟢 OK | account `trendlet` active. **0/15 template SIDs configured** — `notifyCustomerOnStatusChange` will log skipped until SIDs are pasted into `statuses.twilio_template_sid`. |
| OpenAI | 🔴 **Auth failed** | HTTP 401 `Incorrect API key provided` — key invalid or rotated. AI features are Phase 2 (deferred), so non-blocking, but the key in `.env.local` should be replaced or removed. |
| OpenRouter | 🟢 OK | model list returned (Anthropic Claude Haiku, etc.). Could be used as OpenAI fallback when AI features ship. |
| DHL | ⚪ Not configured | mock mode |
| Hubstaff | ⚪ Not configured | mock mode |
| Resend | ⚪ Not configured | mock mode |

### Auth fix mid-phase
While debugging "Application error" on first login: discovered a **redirect loop** (`/dashboard` → `/login?error=forbidden` → `/dashboard` …). Cause: `getCurrentUser()` was reading roles from `auth.users.app_metadata.user_roles` (always undefined — Supabase persists hook output to JWT claims, not the user record). DB fallback used the regular RLS-aware client, which is blocked by `user_roles` policy requiring `jwt_is_admin()` — chicken-and-egg. **Fix:** DB fallback now uses service-role client, scoped to `user_id = user.id`. Safe (own user only) and unblocks first sign-in for any new admin.

### UX fix mid-phase
Orders table rows are now fully clickable (whole row navigates, not just the order-number cell). Saved as a feedback memory so the same pattern applies to invoices/shipments/returns tables.

### Why mock data, not Shopify
User attempted real Shopify backfill; the access token in `.env.local` returned **HTTP 401** ("Invalid API key or access token"). User chose to proceed with mock data instead of regenerating the token. Mock data is marked: `orders.shopify_order_id LIKE 'mock-%'` and `orders.raw_payload ->> '_mock' = 'true'`. Single-statement cleanup: `DELETE FROM orders WHERE shopify_order_id LIKE 'mock-%'` (cascades to sub_orders, customer_invoices).

---

## Resume checklist (read this first when reopening)

### 1. Verify environment

```bash
cd "d:/claude code project/Trendlet/app"
ls supabase/migrations/    # should show 17 files
ls node_modules/ | head    # confirms deps installed
npx tsc --noEmit           # should pass with 0 errors
```

If `node_modules/` is missing, run `npm install`.

### 2. Confirm Supabase state via MCP

```
mcp__claude_ai_Supabase__list_tables(project_id="kfrjqpjprvvsibwmrqph", schemas=["public"], verbose=false)
```

Expected: 31 tables, all `rls_enabled: true`. Seed counts:
- `statuses`: 15 rows
- `settings`: 9 rows
- `ai_models`: 5 rows
- `carriers`: 3 rows
- `stores`: 1 row (Trendslet)
- `profiles`, `user_roles`: 0 rows until first admin is created (Phase 2 manual step)

### 3. Manual blockers (resolved at start of Phase 3)

**A. JWT Custom Access Token Hook** — ✅ Enabled in Supabase Dashboard. Verified by calling `public.custom_access_token_hook()` directly via MCP — hook returns `claims.user_roles` and `claims.app_metadata.user_roles` correctly populated for the admin user.

**B. First admin user** — ✅ Created.
- `auth.users.id`: `99126bae-c846-400e-9d36-7a0d34b3a1f6`
- email: `ai@trendlet.com`
- `public.profiles`: full_name='Mohammed Almateri', region='KSA', is_active=true
- `public.user_roles`: role='admin'

---

## What was built (Phase 1)

### Files created
```
Trendlet/app/
├── package.json              # Next 14.2.18, deps installed
├── tsconfig.json             # strict TS, paths "@/*"
├── next.config.mjs           # serverActions 5mb, image domains
├── tailwind.config.ts        # design tokens (navy #0C447C, status palettes)
├── postcss.config.mjs
├── next-env.d.ts
├── .gitignore
├── .env.local                # ALL credentials wired (see below)
├── middleware.ts             # session refresh, auth gate
├── app/
│   ├── globals.css           # design tokens, hairline borders, sidebar styles
│   ├── layout.tsx            # Inter font 400/500, Toaster, Providers
│   └── page.tsx              # role-based redirect to /dashboard|/queue|/pipeline|/deliveries
├── components/
│   └── providers.tsx         # TanStack Query (staleTime 30s)
├── lib/
│   ├── utils.ts              # cn() helper
│   ├── constants.ts          # STATUSES (15), ROLE_STATUS_WHITELIST, ROLES
│   ├── auth/
│   │   ├── get-current-user.ts   # reads JWT user_roles claim with DB fallback
│   │   └── require-role.ts       # requireRole() / requireAdmin() server-side guards
│   ├── supabase/
│   │   ├── client.ts             # browser client
│   │   ├── server.ts             # SSR + service-role clients
│   │   └── middleware.ts         # session refresh + redirect logic
│   ├── types/
│   │   └── database.ts           # MINIMAL stub. REGENERATE after migrations:
│   │                             #   npx supabase gen types typescript \
│   │                             #     --project-id kfrjqpjprvvsibwmrqph --schema public > lib/types/database.ts
│   └── utils/
│       ├── currency.ts           # formatCurrency() — never aggregates across currencies
│       ├── phone.ts              # normalizeSaudiPhone() → +9665XXXXXXXX
│       └── date.ts               # relativeTime, shortDate, fullDateTime
└── supabase/
    └── migrations/
        ├── 20260427000001_extensions.sql
        ├── 20260427000002_enums.sql
        ├── 20260427000003_core_tables.sql
        ├── 20260427000004_dependent_tables.sql
        ├── 20260427000005_views.sql
        ├── 20260427000006_functions.sql
        ├── 20260427000007_triggers.sql            ← patched mid-flight (relkind='r' filter)
        ├── 20260427000008_rls_policies.sql
        ├── 20260427000009_column_isolation.sql
        ├── 20260427000010_storage_buckets.sql
        ├── 20260427000011_seed.sql
        ├── 20260427000012_jwt_auth_hook.sql
        ├── 20260427000013_materialized_views.sql
        ├── 20260427000014_saved_views.sql
        ├── 20260427000015_notifications_archive.sql
        ├── 20260427000016_search_function.sql
        └── 20260427000017_pg_cron_schedules.sql
```

### Credentials in `.env.local`
- ✅ Supabase URL, anon key, service role key (project `kfrjqpjprvvsibwmrqph`)
- ✅ Pooler URL (port 6543) + Direct URL (port 5432) — derived from password `EIWY2scB5YuKB9I5`
- ✅ Shopify (live): API key, secret, access token, shop domain `1jtyqy-0w.myshopify.com`, webhook secret
- ✅ OpenAI, OpenRouter
- ✅ Twilio WhatsApp (live): SID, token, from `whatsapp:+966552552787`
- ⚠️ DHL: only `DHL_BASE_URL` — `DHL_API_KEY` missing → mocked
- ⚠️ Hubstaff: token missing → mocked
- ⚠️ Resend: missing → mocked
- ✅ NEXTAUTH_SECRET, app URL

---

## What was built (Phase 2)

**All 17 migrations applied successfully** to `kfrjqpjprvvsibwmrqph`. Verified via MCP `list_tables`.

### Schema snapshot
- **31 tables** (29 spec + `saved_views` + `notifications_archive`), all RLS-enabled
- **5 pricing-stripped views** (`v_orders_employee`, `v_sub_orders_employee`, `v_supplier_invoices_employee`, `v_supplier_invoice_items_employee`, `v_settings_employee`)
- **5 materialized views** (`mv_dashboard_kpis`, `mv_revenue_by_currency`, `mv_team_load`, `mv_top_brands_30d`, `mv_team_performance_30d`)
- **4 storage buckets**, all private (`supplier-invoices`, `customer-invoices`, `shipping-labels`, `invoice-templates`)
- **Functions**: `next_invoice_sequence`, `is_admin`, `user_has_role`, `auto_assign_sub_order`, `match_brand_from_vendor`, `set_updated_at`, `log_status_change`, `enforce_status_whitelist`, `notify_on_unassigned`, `enforce_brand_region`, `custom_access_token_hook`, `jwt_is_admin`, `jwt_has_role`, `archive_old_notifications`, `command_palette_search`
- **Triggers**: status change logging, status whitelist enforcement, unassigned notifications, brand-region enforcement, generic `updated_at` on every base table
- **5 pg_cron jobs**:
  - `refresh-dashboard-kpis` (every 5 min)
  - `refresh-analytics-views` (every 15 min)
  - `archive-old-notifications` (3am daily)
  - `evaluate-sla-status` (every 10 min)
  - `trim-activity-log` (4am daily)

### Pricing isolation enforced
- `REVOKE SELECT (subtotal, total, currency) ON orders FROM authenticated`
- `REVOKE SELECT (unit_price, currency) ON sub_orders FROM authenticated`
- `REVOKE SELECT (unit_price, line_total) ON supplier_invoice_items FROM authenticated`
- `REVOKE SELECT (invoice_total, currency) ON supplier_invoices FROM authenticated`
- Employees query through `v_*_employee` views; admins use service-role client server-side.

### Issue encountered + fix
**Migration 07 (triggers) failed first attempt** — the dynamic `updated_at` trigger loop iterated `information_schema.columns` which includes views. Views can't have row-level triggers.

**Fix applied:** filtered the loop to base tables only via `pg_class.relkind = 'r'`. Re-ran successfully. Local file `supabase/migrations/20260427000007_triggers.sql` was updated to match.

---

## What was built (Phase 3)

### Files created
```
Trendlet/app/
├── lib/types/database.ts          # REGENERATED via Supabase MCP (2,500 lines, all 31 tables)
├── components/
│   ├── ui/
│   │   ├── button.tsx             # primary/secondary/ghost/danger × sm/md/lg
│   │   ├── input.tsx              # 13px, hairline border, navy focus ring
│   │   └── label.tsx              # Radix-based, 12px / 500
│   ├── brand/logo.tsx             # red 'T' square + "Trendslet" / subtitle
│   └── nav/
│       ├── nav-items.ts           # 3-section nav model + visibleSections(roles)
│       ├── sidebar.tsx            # 220px dark frame, store header, 3 groups, user chip footer
│       ├── sidebar-nav-item.tsx   # client comp; active-route highlight via usePathname
│       ├── user-dropdown.tsx      # Radix DropdownMenu, opens upward, 320px #2A2A2A, 5 sections + sign out
│       ├── utility-bar.tsx        # search 280px + bell + EN pill (no topbar)
│       ├── mobile-topbar.tsx      # mobile only: hamburger + logo + bell
│       └── bottom-nav.tsx         # mobile only: 5 icons (Home/Orders/Search/More/Profile)
└── app/
    ├── (auth)/                    # route group — auth-shell pages
    │   ├── layout.tsx             # centered card on bg-page
    │   ├── login/
    │   │   ├── page.tsx           # 380px card, Welcome back, NO signup/SSO
    │   │   ├── login-form.tsx     # client form, useFormState
    │   │   └── actions.ts         # server action: signInWithPassword + redirect
    │   ├── forgot-password/
    │   │   ├── page.tsx
    │   │   ├── forgot-form.tsx    # neutral confirmation (never leaks email existence)
    │   │   └── actions.ts
    │   └── setup/[token]/
    │       ├── page.tsx           # exchanges Supabase invite token_hash via verifyOtp
    │       ├── setup-form.tsx     # password + confirm + accept-terms
    │       └── actions.ts         # updateUser({ password }) + flips profile.is_active=true
    └── (app)/                     # route group — authenticated app shell
        ├── layout.tsx             # Sidebar + UtilityBar + MobileTopbar + BottomNav
        └── dashboard/page.tsx     # empty placeholder, requireAdmin()
```

### Dependency change
- `package.json`: pinned `@supabase/supabase-js: ~2.46.2` (was caret `^2.46.1`, npm had pulled 2.104.x which broke type narrowing in `@supabase/ssr@0.5.2`). Surgical fix; no API surface changes downstream.

### Verification
- `npx tsc --noEmit` → 0 errors
- `npm run build` → all 5 routes (`/`, `/dashboard`, `/login`, `/forgot-password`, `/setup/[token]`) compile clean. First Load JS: 87–104 kB.
- Dev server boot + curl probes:
  - `GET /login` → 200, full HTML with "Welcome back", email/password fields, Forgot link, navy submit, info banner, footer
  - `GET /dashboard` (unauthed) → 307 → `/login?next=/dashboard`
  - `GET /` (unauthed) → 307 → `/login?next=/`
  - `GET /forgot-password` → 200, "Reset your password" heading
  - `GET /setup/abc` (no token_hash) → 200, "invitation link is invalid" message
- JWT hook verified end-to-end via MCP — returns `claims.user_roles=["admin"]` and `claims.app_metadata.user_roles=["admin"]` for the admin user
- **NOT YET DONE** — actual browser sign-in (requires the password set during Supabase Dashboard user creation, which only the user knows). Spec compliance is HTML-level, not interaction-level.

### Decisions already made (do not re-decide)
- ❌ NO topbar — sidebar + page utility bar only
- ❌ NO Settings page — settings live in user dropdown / Invoices modal
- ❌ NO language toggle in dashboard — English-only admin/employee UI
- ❌ NO role switcher modal — multi-role users see all relevant nav
- ❌ NO subtitles or "last sync" stamps under page headings
- ❌ NO emojis in UI (except status indicators)
- ❌ NO font weights other than 400 / 500
- ❌ NO serif fonts
- ❌ NO Sign up / Google SSO — invite-only auth
- ❌ NO write-back to Shopify — read-only integration

---

## What was built (Phase 4 — partial)

### New files
```
Trendlet/app/
├── lib/queries/orders.ts                           # fetchAdminOrders, fetchDashboardKpis,
│                                                   # fetchRevenueByCurrency, fetchTeamLoad
├── components/
│   ├── common/empty-state.tsx
│   ├── status/
│   │   ├── status-pill.tsx                         # color-coded badge driven by STATUS_BY_CODE
│   │   └── status-summary-bar.tsx                  # multi-color proportional bar + inline counts
│   ├── dashboard/
│   │   ├── kpi-card.tsx                            # standard tile + hero (navy) variant
│   │   └── team-load-card.tsx                      # team-color top dot + load %
│   └── orders/
│       ├── orders-table.tsx                        # full admin table with red border-left for urgent
│       └── filter-tabs.tsx                         # All / Active / Delayed / Done / Unassigned
└── app/(app)/
    ├── dashboard/page.tsx                          # KPIs + revenue by currency + team load + recent orders
    └── orders/
        ├── page.tsx                                # filter tabs + full table
        ├── [id]/page.tsx                           # breadcrumb + sub-orders + status history + customer rail
        └── unassigned/
            ├── page.tsx                            # unassigned sub-orders queue
            ├── auto-assign-button.tsx              # client form
            └── actions.ts                          # server action calling auto_assign_sub_order()
```

### Mock data shape
- **6 brands**: Aesop, COS, Acne Studios, Maison Kitsuné, Ganni, Le Labo (with aliases for fuzzy matching)
- **25 customers** with Saudi names, +9665 phones, addresses across Riyadh / Jeddah / Dammam / Mecca / Medina
- **40 orders** spanning 0–58 days ago, distributed across all workflow stages
- **58 sub-orders** with status mix: 12 delivered, 9 under_review, 6 shipped, 5 delivered_to_warehouse, 4 each in pending/preparing/in_progress, 3 each in purchased_in_store / arrived_in_ksa / out_for_delivery / purchased_online, 1 out_of_stock, 1 cancelled
- **4 unassigned sub-orders** (Vintage Designer Handbag, Limited Edition Sneakers, Rare Cologne Set, Custom Order) — testing the auto-assign flow
- **Currency mix**: SAR 48 / EUR 5 / USD 5 — exercises the per-currency revenue rows
- **4 admin notifications** auto-created by `trg_notify_on_unassigned`

### Verification
- `npx tsc --noEmit` → 0 errors
- `npm run build` → 9 routes, all clean. New routes: `/dashboard` (179B + 94kB shared), `/orders`, `/orders/[id]`, `/orders/unassigned`
- Direct query smoke test confirmed mv_dashboard_kpis returns `total_orders_30d: 27, active_count: 44`, mv_revenue_by_currency returns 3 currencies, orders join with customers + sub_orders works
- Unauthed routes redirect to `/login?next=...` (307) ✓
- **NOT YET DONE** — actual browser sign-in test (need user's password). Spec compliance is HTML-level + query-level, not interactive.

### Known gaps / next steps in Phase 4
- **`mv_team_load` is empty** until non-admin employees are invited (admin role isn't bucketed into sourcing/warehouse/etc). Cards render with 0/0/0% — visually correct, not a bug.
- **`is_at_risk` / `is_delayed` flags** are all false (SLA evaluation hasn't run; sla_due_at is NULL on seeded rows). `evaluate-sla-status` cron runs every 10min — will populate once `sla_due_at` is set. Not blocking; UI handles both states.
- **No table virtualization yet.** With 40 orders we don't need it. Add when count > 100 — `OrdersTable` is small enough to swap in TanStack Virtual without restructuring.
- **No expandable rows in OrdersTable yet** — spec calls for sub-orders inline expansion. Detail page covers the same info; expansion is a polish layer for Phase 7.
- **No bulk actions, no inline status dropdown, no Pipeline view** — all spec items deferred. Build them when there's a use case.

## Phase 4 — full file inventory (added since last update)

```
Trendlet/app/
├── lib/queries/invoices.ts                                  # fetchInvoices, fetchInvoiceCounts
├── components/orders/order-row.tsx                          # client row with whole-row click
└── app/(app)/
    ├── invoices/
    │   ├── page.tsx                                         # status tabs + KPIs + card list
    │   └── [id]/page.tsx                                    # PDF preview placeholder + AI reasoning + calc + customer rail
    ├── activity-log/page.tsx                                # day-grouped feed (Today/Yesterday/EEEE)
    ├── sla-health/page.tsx                                  # active/at-risk/delayed buckets per stage
    ├── team-load/page.tsx                                   # team cards + employee performance table
    ├── payroll/page.tsx                                     # empty state — Hubstaff not connected
    ├── shipments/page.tsx                                   # tracking table (empty until warehouse ships)
    ├── returns/page.tsx                                     # returned sub_orders list
    ├── reports/page.tsx                                     # revenue by currency + top brands + team perf (revalidate 3600)
    ├── queue/page.tsx                                       # sourcing/fulfiller/admin — pending sub-orders
    ├── pipeline/page.tsx                                    # warehouse/fulfiller/admin — kanban-lite by status
    ├── eu-fulfillment/page.tsx                              # fulfiller/admin — empty until role assigned
    └── deliveries/page.tsx                                  # ksa_operator/admin — KSA last-mile list
```

### Verification (final Phase 4 build)
- `npx tsc --noEmit` → 0 errors
- `npm run build` → 21 routes compile clean. Authenticated pages: 87–110 kB First Load JS.
- All sidebar links now resolve to real pages — no dead links.

## What was built (Phase 5)

### New files
```
Trendlet/app/
├── lib/
│   ├── queries/notifications.ts                        # fetchRecentNotifications, fetchUnreadCount
│   └── offline/queue.ts                                # idb-backed mutation queue + flushQueue()
├── components/
│   ├── notifications/notifications-panel.tsx           # Radix Popover + Realtime subscription, mark read
│   ├── nav/command-palette.tsx                         # cmdk dialog wired to command_palette_search()
│   ├── nav/search-trigger.tsx                          # client island opening the palette via custom event
│   ├── deliveries/delivery-actions.tsx                 # online + offline-queued status updates
│   └── offline/sw-register.tsx                         # registers /sw.js in production
├── public/
│   └── sw.js                                           # network-first SW; caches /deliveries + _next/static
├── app/(app)/
│   ├── layout.tsx                                      # mounts panel + palette + SW register
│   └── deliveries/
│       ├── actions.ts                                  # setDeliveryStatusAction (RLS + status whitelist)
│       └── page.tsx                                    # row layout extended with DeliveryActions
└── supabase/migrations/
    └── 20260428000001_realtime_notifications.sql       # ALTER PUBLICATION add notifications
```

### Decisions made
- **Bell trigger lives inside `NotificationsPanel`**, slotted into `UtilityBar` and `MobileTopbar` via a `notifications` prop. Each instance uses a unique Realtime channel name (`desktop` / `mobile`) so the two mounts don't collide on the same WebSocket name.
- **No archive feature** — notifications schema has `read_at` only. Spec §7.12 calls for "Mark all read", which is what shipped. Adding archive would require a column.
- **Command palette uses a custom DOM event (`optify:open-palette`)** to bridge the server-rendered `UtilityBar` to the client palette without prop-drilling state through the layout. Keyboard ⌘K / Ctrl+K works globally.
- **`SearchTrigger` is a tiny client island** so `UtilityBar` stays a server component.
- **Offline mutation queue is keyed by `subOrderId`** — a second tap on the same row replaces the queued status (latest tap wins). Avoids unbounded retry storms.
- **Service worker is dev-disabled** (`process.env.NODE_ENV !== "production"` guard in `sw-register.tsx`) — Next.js dev HMR + SW caching fight each other.
- **SW scope is narrow** — only `/deliveries` HTML and `/_next/static/*`. Supabase REST goes straight to network; stale data here is worse than an offline error.
- **KSA action UI was added as part of Phase 5**, not deferred — the Phase 4 `/deliveries` page was read-only. Action buttons (`Out for delivery`, `Mark delivered`, `Returned`) are gated by the DB's `enforce_status_whitelist` trigger, so wrong transitions surface as Postgres errors rather than silent passes.

### Verification
- `npx tsc --noEmit` → 0 errors
- `npm run build` → 21 routes compile clean. `/deliveries` grew to 2.72 kB / 99.2 kB (was 172 B / 87.4 kB) — entirely the action buttons + idb queue. Other routes unchanged.
- Realtime: `notifications` is now in the `supabase_realtime` publication (verified via MCP).
- `command_palette_search` function returns 6 buckets and is callable by `authenticated` (proacl checked).
- KSA whitelist verified — only 4 statuses can be set by `ksa_operator`: `arrived_in_ksa`, `out_for_delivery`, `delivered`, `returned`.

### Post-Phase-5 audit remediation (same session)
- **Added route-group loading + error boundaries** — `app/(app)/loading.tsx` (skeleton: heading + 4 KPI tiles + 6 row blocks), `app/(app)/error.tsx` (red AlertCircle + reset button + digest). Same pair under `app/(auth)/`. Closes spec §15 "loading state / error state" quality gates.
- **Refactored `DeliveryActions` to `useOptimistic`** — `useState` for the in-flight optimistic value was replaced with `useOptimistic`, which auto-rolls back on transition error. Spec §14.5 strict compliance. The persistent `queuedStatus` (IDB-backed across sessions) is kept as a separate `useState` because `useOptimistic` is transient by design and clears at transition end.
- **Verification:** `npx tsc --noEmit` 0 errors · `npm run build` 21 routes clean (no size regressions).

### Known gaps / next steps
- **Browser smoke test for the bell + palette + offline flow has NOT been done** by Claude — requires the user's password to sign in. Spec compliance is HTML-level + build-level only.
- **Lighthouse runtime numbers (FCP / LCP / TTI / CLS)** still pending — needs `npm run build && npm run start` + Chrome DevTools Lighthouse on the user's machine. Static bundle sizes are healthy (87–110 kB First Load JS, well under typical 200 kB threshold).
- **Service worker in dev:** disabled by design; to test offline behavior, run `npm run build && npm run start` then DevTools → Application → Service Workers → Offline.
- **`flushQueue` does not back off on failure** — every `online` / `focus` event retries the full queue. Fine for the expected scale (a single KSA driver with a handful of pending updates); consider exponential backoff if the queue ever grows large.
- **No "queued count" indicator in the bell or sidebar** — drivers see per-row "Queued" badges only. Add a global indicator if it becomes a UX issue once real drivers use it.
- **WhatsApp customer notification on `delivered`** is not yet wired — spec §11 places the Twilio integration in Phase 6, and `statuses.notifies_customer = true` for `delivered` is a flag waiting on that wiring.
- **Lighthouse + a11y sweep** still pending — was item 4 of the original Phase 5 list. Worth running once Phase 6 integrations land so the audit reflects the real production payload.

## What was built (Phase 6)

### New files
```
Trendlet/app/
├── lib/
│   ├── api-client.ts                                 # apiCall() + logSkipped() — single funnel for external HTTP
│   └── integrations/
│       ├── shopify.ts                                # (intentionally absent — webhook handles inbound; no outbound writes per spec)
│       ├── twilio.ts                                 # notifyCustomerOnStatusChange() — Content Template send + no-op when SID missing
│       ├── hubstaff.ts                               # syncHubstaff() — pulls /v2/activities/daily, upserts time_entries
│       ├── dhl.ts                                    # createDhlLabel() — POST /shipments, mock returns MOCK-XXXXXXXX tracking
│       └── resend.ts                                 # sendEmail() — POST /emails, mock returns success without sending
├── app/(app)/deliveries/actions.ts                   # extended: fires Twilio after status update (fire-and-forget)
└── app/api/
    ├── cron/pull-hubstaff/route.ts                   # GET, gated by CRON_SECRET; 24h sync window
    └── webhooks/shopify/orders-create/route.ts       # POST; HMAC-SHA256 verify + idempotency + auto-split
```

### Architecture decisions
- **All external HTTP routes through `apiCall()`** — the wrapper logs metadata only to `api_logs` (service, endpoint, method, http_status, latency_ms, cost_usd, error_message). NEVER request/response bodies, headers, or secrets (spec §12).
- **Mock fallbacks log as `status='skipped'`** with reason — admins can audit "what would have fired" via SQL on `api_logs`. Live calls log as `'success'` or `'error'`.
- **Twilio is a no-op until SIDs are pasted** — `notifyCustomerOnStatusChange()` checks `statuses.twilio_template_sid IS NULL` and short-circuits with a `'skipped'` log entry. Goes live the moment you paste a SID into the table; no code change needed.
- **Shopify webhook is idempotent** — second delivery of the same `shopify_order_id` returns `{ ok: true, action: 'noop' }` without re-inserting. Safe for Shopify's at-least-once delivery semantics.
- **HMAC verify uses `crypto.timingSafeEqual`** with explicit length check — no early bailout on length mismatch is exploitable.
- **Twilio call from `setDeliveryStatusAction` is fire-and-forget** (`void notifyCustomerOnStatusChange(...).catch(...)`) — KSA driver doesn't wait for WhatsApp to round-trip before the UI updates.
- **`runtime = "nodejs"` on both API routes** — the Edge runtime would block `node:crypto` (Shopify HMAC) and the service-role Supabase client.
- **`store_id` hardcoded in the webhook** to the single Trendslet store UUID. Multi-store routing is a Phase 7+ concern; flagging here.
- **TypeScript escape hatches in webhook + hubstaff** — three `as any` casts with eslint-disable comments because the generated DB types' overload resolution disagrees with single-row insert payloads. Cleaner fix is to regenerate types after a Supabase CLI bump, but works correctly at runtime.

### Activation checklist (what needs to happen for these to actually fire)

| Integration | Env var(s) | Other action | Status |
|---|---|---|---|
| Shopify webhook | `SHOPIFY_WEBHOOK_SECRET` ✓ already set | Register webhook in Shopify Admin → Notifications → Webhooks: `POST {APP_URL}/api/webhooks/shopify/orders-create`, format JSON | Endpoint ready, not registered |
| Twilio WhatsApp | `TWILIO_*` ✓ already set | Paste 8 Content Template SIDs into `statuses.twilio_template_sid` (one per `notifies_customer = true` status) | Code ready, no-ops until SIDs in DB |
| Hubstaff cron | `HUBSTAFF_TOKEN` (missing → mock), `CRON_SECRET` (missing) | Add both to `.env.local`; add to `vercel.json` crons: `{ "path": "/api/cron/pull-hubstaff", "schedule": "0 * * * *" }` | Mock mode until token added |
| DHL labels | `DHL_API_KEY` (missing → mock) | Add when DHL Express account ready | Mock mode |
| Resend emails | `RESEND_API_KEY` (missing → mock) | Add when Resend account ready | Mock mode |

### Verification
- `npx tsc --noEmit` → 0 errors
- `npm run build` → 23 routes compile clean (added `/api/cron/pull-hubstaff` + `/api/webhooks/shopify/orders-create`). UI routes unchanged in size.
- **Not exercised end-to-end** — no live Shopify webhook delivery has been attempted, no real Hubstaff token is configured, no Twilio template SIDs are in the DB. All mocks log to `api_logs` correctly per their unit shapes; full integration testing happens once the activation checklist above is worked through.

### Known gaps / next steps
- **No `vercel.json`** — needs the cron schedule entry above before the Hubstaff cron will fire in production.
- **No "Sync now" button on /payroll** — admin can only wait for the hourly cron. Add a manual-trigger button in Phase 7 polish.
- **`DeliveryActions` is the only call site for `notifyCustomerOnStatusChange`** — when sourcing/warehouse status-change UI ships (currently deferred), wire the same call into those server actions.
- **Shopify `orders/updated` webhook not built** — only `orders/create` ships. Spec §11 lists `orders/updated` as future. Customer info changes won't sync.
- **No supplier invoice OCR / AI customer invoice generation** — spec §11 places these in Phase 2 ("after MVP stabilizes"). Phase 6 ships the wrapper they'll need; the actual AI calls are deferred.
- **`store_id` hardcoded** in Shopify webhook. Multi-store ingestion needs a header lookup or per-webhook-secret mapping.

## What was built (Phase 7 — partial)

### New files
```
Trendlet/app/
├── vercel.json                                       # crons: hourly Hubstaff pull
├── app/(app)/payroll/
│   ├── actions.ts                                    # syncHubstaffAction (admin-only, calls syncHubstaff)
│   ├── sync-button.tsx                               # client island: useTransition + sonner toast
│   └── page.tsx                                      # extended: heading row now includes Sync now button
├── app/(app)/setup/integrations/
│   ├── page.tsx                                      # server: runs checkAll() on each visit, renders 8 service rows
│   ├── actions.ts                                    # recheckIntegrationsAction (admin-only)
│   └── recheck-button.tsx                            # client island: re-check all + toast summary
└── lib/integrations/health.ts                        # checkSupabase/Shopify/Twilio/OpenAI/OpenRouter/DHL/Hubstaff/Resend; checkAll() fans out
```

### Decisions
- **Health checks are read-only** — every endpoint chosen has zero side effects. Shopify GET `/shop.json`, Twilio GET `/Accounts/{SID}.json`, OpenAI/OpenRouter GET `/models`, Hubstaff GET `/v2/users/me`, Resend GET `/domains`. No messages sent, no labels created, no AI tokens spent.
- **DHL is "skipped"** — DHL Express has no free no-op endpoint; the only meaningful POST creates real labels. Page shows credentials present + "no safe ping endpoint".
- **Each check goes through `apiCall()`** — admins get a paper trail of who checked what and when in `api_logs`.
- **Twilio "ok" status includes the template SID count** ("0/15 template SIDs configured") so the gap is visible at a glance.
- **`checkAll()` uses `Promise.all`** — 8 parallel HTTP calls, page loads in roughly the slowest single check (~700ms in testing).

### Decisions
- **No separate `/api/sync-hubstaff` route** — used a server action because the trigger is a single authenticated admin click. The cron route stays separate (Bearer-token gated, Vercel cron only).
- **`vercel.json` is minimal** — only the Hubstaff cron is wired. Shopify polling fallback (spec mentions a 60-min poll for missed webhooks) is deferred until missed-delivery is observed.
- **Sync button shows mode-aware toast** — "mock mode" vs "5/12 entries" so admin knows whether the call actually went out.

### Verification
- `npx tsc --noEmit` → 0 errors
- `npm run build` → 23 routes clean. `/payroll` grew 171B → 1.41 kB / 97.9 kB.

### Deferred to final test pass (per user)
- **Lighthouse + a11y sweep** — needs `npm run start` + Chrome DevTools.
- **Spec §15 quality-gates walkthrough** — best done against the live integrated payload.
- **Wiring `notifyCustomerOnStatusChange` into other status-change UIs** — sourcing/warehouse/fulfiller UIs don't ship status-change buttons yet (Phase 4 left them as read-only views). Will be addressed when those UIs are built.

## Phase 8 (next, when ready)

**Goal:** Full end-to-end testing of all integrations + Lighthouse run + final production checklist.

### Activation steps to do before testing
1. Add `CRON_SECRET=<long random string>` to `.env.local` and Vercel env
2. Register Shopify webhook in Shopify Admin (POST `{APP_URL}/api/webhooks/shopify/orders-create`, JSON)
3. Paste 8 Twilio Content Template SIDs into `statuses.twilio_template_sid`
4. Add `HUBSTAFF_TOKEN`, `DHL_API_KEY`, `RESEND_API_KEY` to `.env.local` as accounts come online
5. Deploy to Vercel Pro plan (Hobby has 10s timeout limits per spec §2)

### Test pass
1. Login → bell shows existing 4 unassigned alerts
2. Trigger a Shopify test order → webhook ingests → bell pings via Realtime
3. Tap "Mark delivered" on a /deliveries row → Twilio sends WhatsApp template
4. /payroll → "Sync now" → Hubstaff entries appear
5. Lighthouse on /dashboard, /orders, /deliveries → confirm §14 budgets
6. Walk through spec §15 quality gates checklist

## Phases not yet started

- **Phase 4** — Admin pages: Dashboard, Orders (table + pipeline), Order detail, Unassigned queue, Invoices list + detail, Activity log, Reports (ISR), SLA Health, Team Load, Shipments, Returns
- **Phase 5** — Employee views: Sourcing queue, Warehouse pipeline, Fulfiller (dual cycle), KSA deliveries, Payroll. Service worker + IndexedDB offline mode for KSA team
- **Phase 6** — Integrations (CHECKPOINT before live calls): Shopify webhook (HMAC verify), Twilio WhatsApp (8 templates), Hubstaff (mock), DHL (mock)
- **Phase 7** — Polish: command palette ⌘K, notifications panel, mobile bottom nav sweeps, Lighthouse + a11y passes, production checklist

---

## Critical paths (don't break these)

### Files that hold critical context
- `Trendlet/CLAUDE.md` — project edit policy (95% confidence rule, Karpathy principles)
- `Trendlet/OPTIFY_SYSTEM_PROMPT.md` — full spec, 20+ pages, design system, §14 perf requirements
- `Trendlet/OPTIFY_DATABASE_SCHEMA.md` — DB schema source (already implemented; reference only)
- `Trendlet/OPTIFY_VISUAL_REFERENCE.md` — page-by-page ASCII wireframes
- `Trendlet/README.md` — package overview, production checklist
- `Trendlet/app/.env.local` — all credentials
- `Trendlet/app/lib/supabase/server.ts` — server + service-role clients (service-role NEVER on client)
- `Trendlet/app/lib/auth/get-current-user.ts` — reads JWT roles (depends on hook being enabled)
- `.mcp.json` (project root) — Supabase MCP config (project_ref, features list)

### Performance targets (from spec §14)
- FCP < 1s, TTI < 2s, LCP < 1.5s, API p95 < 300ms, DB p95 < 100ms
- JWT-based RLS (50× speedup) — depends on auth hook
- TanStack Virtual for any table > 100 rows
- Optimistic updates on all employee mutation actions
- ISR with 1h revalidate on `/reports`
- Service worker + IndexedDB for KSA offline mode

### Things that must stay aligned
- The 15 statuses in `lib/constants.ts` MUST match seed data in `supabase/migrations/20260427000011_seed.sql` MUST match the `statuses` table
- Pricing column REVOKEs in migration 09 — never `GRANT SELECT (price...) TO authenticated` anywhere
- All external API calls go through a single wrapper (to be built in `lib/api-client.ts`) that logs to `api_logs` (metadata only, NO request/response bodies, NO secrets)

---

## How to verify the build is healthy

```bash
cd "d:/claude code project/Trendlet/app"
npx tsc --noEmit                         # 0 errors expected
npm run build                             # should succeed (not run yet at this checkpoint)
npm run dev                               # http://localhost:3000 → /login redirect
```

Via MCP:
```
mcp__claude_ai_Supabase__execute_sql(
  project_id="kfrjqpjprvvsibwmrqph",
  query="SELECT (SELECT COUNT(*) FROM statuses) AS s, (SELECT COUNT(*) FROM cron.job WHERE jobname LIKE 'refresh-%' OR jobname LIKE 'evaluate-%' OR jobname LIKE 'archive-%' OR jobname LIKE 'trim-%') AS jobs"
)
```
Expected: `s=15, jobs=5`.

---

## Open questions / decisions deferred

- **Brand seed data** — no brands seeded yet. They get created by admin in `/brands & assignments` (in-context settings). First Shopify webhook will populate `brand_name_raw` for any unmapped vendors.
- **Invoice templates** — `invoice_templates` table empty. Admin uploads PDFs via Invoices → Settings → Templates tab.
- **Twilio Content Template SIDs** — `statuses.twilio_template_sid` is NULL for all 15. User must paste the 8 pre-approved SIDs into the table once Twilio approves them.
- **Hubstaff / DHL / Resend** — mocked. Wire real integrations in Phase 6 when credentials provided.

---

## Session 2026-04-29 — Invoice flow + role views (Phases 0–4d)

This session shipped 9 commits expanding the admin invoice workflow into a full review-approve-send pipeline AND replacing the placeholder role pages with proper role-aware views. After this session every employee role lands on its own dedicated workspace.

### Commits in order
- `662d190` — Phase 0: invoice bug fixes (Pending value math, FX label)
- `e8a6807` — Phase 1: review actions UI (approve/reject/reopen/mark-sent)
- `65d7ddb` — Phase 2: PDF generator with supplier barcode (`@react-pdf/renderer` + `bwip-js/node`, signed URL iframe preview, regenerate button)
- `487f6d5` — Phase 3: Zoho Mail outbound integration (mock-mode-first; goes live when ZOHO_* env vars are pasted)
- `34e74d0` — Phase 4a: brand admin page + `brands.markup_percent` migration
- `c52bc24` — Fix: `/admin/brands` 500 caused by ambiguous PostgREST embed (user_roles has dual FK to profiles)
- `e86e603` — Phase 4a+: admin can create + rename brands manually
- `726568c` — Phase 4b: fulfiller view (EU full pipeline) + role whitelist extended (warehouse + fulfiller can drive arrived_in_ksa / out_for_delivery / delivered until KSA shipping integration ships)
- `01b358e` — seed-test-users script (3 test employee accounts created in live Auth)
- `bb2726e` — Fix: separate fulfiller from sourcing/warehouse role visibility (sidebar + landing redirect)
- `75f7cac` — Phase 4c: warehouse view (US late stages, sees ALL US sub-orders)
- `090b11b` — Phase 4d: sourcing view (US early stages, brand-filtered to assignee)

### Schema migrations applied to live Supabase
- `20260428000002_rls_jwt_admin_full.sql` — already applied earlier; remaining is_admin() → jwt_is_admin()
- `20260428000003_webhook_deliveries.sql` — already applied earlier
- `20260429000001_supplier_invoice_barcode.sql` — `supplier_invoices.barcode text` (single barcode per receipt, reproduced verbatim on every customer invoice generated from it; nullable)
- `20260429000002_brand_markup.sql` — `brands.markup_percent numeric(5,2) NOT NULL DEFAULT 0` (snapshotted to customer_invoices at draft time so future markup changes don't retroactively change issued invoices)
- `20260429000003_extend_role_whitelist.sql` — `statuses.allowed_from_roles` extended for `arrived_in_ksa` / `out_for_delivery` / `delivered` to include `warehouse` and `fulfiller` (KSA driver reserved for future shipping-company integration)

Total schema state: 31 tables, 22 migrations applied (was 19 at session start).

### Locked design decisions (do not re-ask in future sessions)
- **3 disjoint employee roles**: `fulfiller` handles EU brands end-to-end; `sourcing` handles US early stages (brand-restricted to their assigned brands); `warehouse` handles US late stages (sees ALL US orders). `ksa_operator` exists in DB but no real users — reserved for future shipping-company integration.
- **Brand routing**: `brands.region` ('US' | 'EU' | 'KSA' | 'GLOBAL') + `brand_assignments.is_primary` drives whose queue an order lands in. Brands without a primary assignee fall to `/orders/unassigned`.
- **Markup**: per-brand only, stored on `brands.markup_percent` (50.00 = 50%). Snapshotted onto `customer_invoices.markup_percent` at draft time. Reassigning a brand to a different employee never changes its markup.
- **Markup math**: `item_price = cost / (1 + markup_percent/100)` — confirmed via schema comment.
- **Barcode**: ONE per supplier invoice (not per item). Reproduced verbatim on every customer invoice split out from that supplier invoice. If `supplier_invoices.barcode` IS NULL, the customer PDF omits the barcode block silently — no fallback.
- **Approve flow**: status flip is durable; PDF render is regenerable. If `approveInvoiceAction` succeeds at the status flip but PDF render fails, status stays `approved` and admin retries via the Regenerate button.
- **Mark-sent flow**: in mock mode (no Zoho env vars), status flips to `sent` after logging api_logs as 'skipped'. In live mode, status flips ONLY if Zoho returns success — failure leaves status as `approved` so admin can retry.
- **Phase 4-team**: admin user-creation UI is deferred. 3 test accounts unblock testing in the meantime; they live in production Auth and must be deleted before launch.
- **AI model picker**: deferred to Phase 4f. Admin will pick OpenRouter model from `/admin/invoice-settings` (not yet built); the choice is stored in `settings` table and read at extraction time.
- **AI extraction failure fallback**: manual data-entry form (deferred to 4f).

### Test accounts in live Supabase (DELETE BEFORE LAUNCH)
| email | role | password |
|---|---|---|
| `fulfiller-test@trendlet.com` | fulfiller | `Trendlet!Test2026` |
| `sourcing-test@trendlet.com` | sourcing | `Trendlet!Test2026` |
| `warehouse-test@trendlet.com` | warehouse | `Trendlet!Test2026` |

The seed script lives at `app/scripts/seed-test-users.mjs` (idempotent — re-running is safe).

### Architectural decisions worth carrying forward
- **`fetchFulfillmentQueue`** is the shared queue fetcher for all 3 role views. Takes `region: 'EU'|'US'` and `assigneeFilter: 'self'|'all'`. Returns `FulfillmentRow[]` with brand + customer joined. Used by `/fulfillment`, `/pipeline`, `/queue`.
- **`SubOrderRow`** client island with `useOptimistic` is also shared across all 3 views. Renders status pill + action buttons; buttons are filtered by the role's whitelist via `getNextStatuses(currentStatus, role, ROLE_STATUS_WHITELIST)`.
- **`setSubOrderStatusAction`** is the shared status-change action. Auth: `requireRole(["fulfiller","warehouse","sourcing","admin"])`. Uses regular client for non-admins so RLS narrows; service-role for admins until JWT carries role claims on first sign-in. Twilio fire-and-forget on `notifies_customer` statuses.
- **PostgREST embed ambiguity**: `user_roles` has TWO FKs to `profiles` (`user_id` and `granted_by`). When joining via `profiles ( user_roles ( role ) )` the embed fails with a 500. Solution: split into two queries and group in JS (already done in `lib/queries/brands.ts`).

### What's deployed
- **Production URL**: https://trendlet.vercel.app
- **HEAD commit**: `090b11b` (Phase 4d shipped)
- **Routes**: 23 dynamic routes, all green build, no warnings, ~87–110 kB First Load JS
- **Vercel project**: trendlet, owner ai@trendlet.com, root directory `app`
- **Auto-deploys** on push to `main`

### What's NOT done yet (Phase 4 remaining work)
- **4e — Supplier invoice upload**: drag-and-drop PDF, store in `supplier-invoices` bucket, attach to a sub-order. Pure data ingestion, no AI yet.
- **4f — AI extraction**: OpenRouter call extracts supplier name + line items + barcode from uploaded PDFs, sourcer maps line items to sub-orders, clicks "create drafts" → customer invoices appear in admin queue. Closes the end-to-end loop. Includes admin AI model picker (`/admin/invoice-settings`) and manual-entry fallback for AI failures.
- **4-team — Admin user-creation UI**: deferred. Test accounts unblock for now.
- **Browser smoke testing**: most Phase 1–4d functionality has been validated by typecheck + build but not yet exercised end-to-end in a real browser session against the live deploy.
