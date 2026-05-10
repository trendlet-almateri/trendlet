# Optify OMS — Complete Build Package (v2.0)

This package contains everything needed to build the Optify Order Management System for Trendslet, from initial scaffolding to production launch — **with full performance and operational quality enhancements built in**.

**v2.0 changes:** Added 15 critical production-grade improvements including JWT-based RLS, materialized views, optimistic updates, virtual scrolling, offline mode for field workers, and more. See the System Prompt §14 for full details.

---

## Files in this package

### 📘 `OPTIFY_SYSTEM_PROMPT.md` (the master prompt)
The complete system specification. Contains:
- Project overview and business context
- Tech stack and file structure
- Design system (colors, typography, spacing)
- Layout architecture
- Authentication and access rules
- Roles and permissions
- Page-by-page specifications (20+ pages)
- Component library
- Responsive behavior
- Notifications system architecture
- Integration specs (Shopify, Twilio, Hubstaff, etc.)
- Security model
- MVP scope vs future phases
- **§14 Performance & operational quality (NEW v2.0)** — JWT RLS, materialized views, optimistic updates, virtual scrolling, offline mode, ISR, React Query, saved views, bulk actions, inline editing
- Build instructions
- Decision log (25 decisions, why certain unusual choices were made)

**Use this as:** The primary context for any AI coding tool (Lovable, Cursor, Claude Code, v0).

### 📗 `OPTIFY_DATABASE_SCHEMA.md` (the database)
Complete Supabase Postgres schema:
- 27 tables with full column definitions
- 5 pricing-isolation views
- All enum types
- All triggers (status logging, whitelist enforcement, auto-assignment)
- All functions (`next_invoice_sequence`, `is_admin`, `match_brand_from_vendor`)
- Complete RLS policies
- Column-level pricing isolation
- Storage bucket configuration
- Seed data (15 statuses, default settings)
- Migration file structure
- **§11 Performance enhancements (NEW v2.0)** — JWT auth hook, materialized views, saved views table, notifications archive, universal search function, pg_cron schedules, indexes audit, connection pooling config

**Use this as:** The database setup script. Run migrations in order before building.

### 📙 `OPTIFY_VISUAL_REFERENCE.md` (the design)
Page-by-page visual descriptions with ASCII wireframes:
- Login page
- Admin dashboard
- Orders (table + pipeline)
- Unassigned queue
- Invoices (list + detail)
- Sourcing/Warehouse/Fulfiller/KSA employee views
- Payroll
- Notifications panel
- Command palette (⌘K)
- Activity log
- Reports/Analytics
- Mobile patterns
- Print styles

**Use this as:** Visual fidelity reference when implementing each page.

### 📕 `README.md` (this file)
Package overview and usage guide.

---

## How to use this package

### Option 1: Full build (recommended)

1. Create a new Next.js 14 project
2. Set up Supabase project
3. Run all migrations from `OPTIFY_DATABASE_SCHEMA.md`
4. **Enable the JWT Custom Access Token Hook in Supabase Dashboard** (critical for performance)
5. **Configure Pooler URL in env vars** (port 6543, not 5432)
6. Paste `OPTIFY_SYSTEM_PROMPT.md` into your AI coding tool's project context
7. Reference `OPTIFY_VISUAL_REFERENCE.md` for individual page details
8. Build in the order specified in the system prompt's §15

### Option 2: Single AI session

Combine all three files into one prompt:

```
Read these three documents in order:
1. [OPTIFY_SYSTEM_PROMPT.md content]
2. [OPTIFY_DATABASE_SCHEMA.md content]
3. [OPTIFY_VISUAL_REFERENCE.md content]

Then build the entire Optify OMS following all specifications.
Start with the database schema migrations, then auth, then pages
in the order specified.
```

### Option 3: Page-by-page (Lovable, v0)

For each page:
1. Open `OPTIFY_VISUAL_REFERENCE.md`, find the page section
2. Open `OPTIFY_SYSTEM_PROMPT.md` §7, find the matching detailed spec
3. Combine both into a focused prompt for that single page
4. Reference the design system from §3 of the system prompt
5. Reference the performance requirements from §14 for that feature

---

## Critical constraints (read first)

These are absolute rules from the design phase. Do not violate them:

🚫 **No topbar** — only sidebar + page utility bar (search/bell/lang)
🚫 **No Settings page in sidebar** — settings are in-context (modals, dropdown sections)
🚫 **No Templates page** — invoice templates managed inside Settings modal
🚫 **No FX conversion** — each currency displays standalone, never aggregated
🚫 **No Sign up / SSO** — invite-only authentication
🚫 **No language toggle in dashboard** — English-only for admin/employee UIs
🚫 **No subtitles or "Last sync" stamps under page headings**
🚫 **No emoji in UI** (except status indicators in some places)
🚫 **No font weights other than 400 and 500**
🚫 **No serif fonts**
🚫 **No api_logs page** — table exists, no UI
🚫 **No role switcher modal** — multi-role users see all nav at once
🚫 **No prices for non-admins** — anywhere, ever
🚫 **No write-back to Shopify** — read-only integration

🚫 **No `is_admin()` in RLS** — use `jwt_is_admin()` instead (50x faster)
🚫 **No port 5432 in app code** — use Pooler URL (port 6543)
🚫 **No raw `<table>` for > 100 rows** — use TanStack Virtual
🚫 **No blocking UI on actions** — always optimistic updates
🚫 **No live data on Reports page** — use ISR with 1h revalidate

---

## Performance requirements (v2.0)

Every page must meet these targets on a mid-tier laptop with 100Mbps:

| Metric | Target |
|---|---|
| First Contentful Paint | < 1s |
| Time to Interactive | < 2s |
| Largest Contentful Paint | < 1.5s |
| API response p95 | < 300ms |
| Database query p95 | < 100ms |

**Key performance technologies (mandatory):**
- ✅ JWT-based RLS (no DB lookup on every query)
- ✅ Materialized views for KPIs (refreshed every 5 min via pg_cron)
- ✅ Connection pooling via PgBouncer (Supabase Pooler URL)
- ✅ TanStack Query for client-side caching
- ✅ TanStack Virtual for tables > 100 rows
- ✅ React's `useOptimistic` for instant UI feedback
- ✅ Service Worker + IndexedDB for offline mode (KSA team)
- ✅ Next.js ISR for static pages (Reports, SLA Health)
- ✅ Trigram indexes for fast text search
- ✅ Notifications archive table (keeps live table small)

---

## Brand assets needed

You'll need to obtain:
- Trendslet logo (the red square "T" in mockups is a placeholder)
- Brand color confirmation (current: navy `#0C447C`, accent red `#E24B4A`)
- Invoice templates (PDF) — Trendslet may have existing branded templates
- WhatsApp Twilio Content Template SIDs (8 pre-approved)

---

## Environment variables needed

```bash
# Supabase (use POOLER URL for app, DIRECT URL for migrations only)
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=postgres://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:6543/postgres
DIRECT_URL=postgres://postgres.[ref]:[pwd]@db.[ref].supabase.co:5432/postgres

# Shopify
SHOPIFY_WEBHOOK_SECRET=
SHOPIFY_ADMIN_TOKEN=

# Twilio (live)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

# Optional (mocked if absent)
OPENAI_API_KEY=
HUBSTAFF_TOKEN=
DHL_API_KEY=
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://operations.trendslet.com
NEXT_PUBLIC_APP_ENV=production
```

---

## Production checklist (v2.0)

Before going live:

### Database
- [ ] All migrations applied successfully (including v2.0 performance migrations)
- [ ] **JWT Custom Access Token Hook enabled in Supabase Dashboard**
- [ ] **pg_cron extension enabled and all 5 schedules running**
- [ ] **Materialized views populated with initial data**
- [ ] RLS enabled on every table with JWT-based policies
- [ ] Seed data inserted (15 statuses, default settings, AI models)
- [ ] `next_invoice_sequence()` function works without race conditions
- [ ] Storage buckets created (all private)
- [ ] At least one admin user created
- [ ] All trigram indexes created for search

### Auth
- [ ] Hardcoded passwords rotated (per `optify-docs.html` known gaps)
- [ ] Invite flow tested end-to-end
- [ ] Forgot password tested
- [ ] Session refresh works on stale tokens
- [ ] Logout clears session and redirects
- [ ] **JWT contains `user_roles` array on login**

### Performance
- [ ] **Pooler URL configured (port 6543)**
- [ ] **TanStack Query installed and provider mounted**
- [ ] **Virtual scrolling on Orders table, Pipeline, Activity log**
- [ ] **Optimistic updates on all employee actions**
- [ ] **Service worker registered for offline mode (KSA)**
- [ ] **ISR enabled on Reports page**
- [ ] Lighthouse scores: Performance > 90, Accessibility > 90
- [ ] No queries > 100ms on tables < 10k rows

### Integrations
- [ ] Shopify webhook receives + verifies HMAC
- [ ] Twilio templates approved and SIDs in `statuses` table
- [ ] Phone normalization works for Saudi numbers
- [ ] Hubstaff sync edge function deployed and scheduled (if Hubstaff active)
- [ ] All external calls go through `apiCall()` wrapper

### UI
- [ ] All 20+ pages render correctly at 1440/1024/768/375 px
- [ ] Loading states (skeletons) on every async data fetch
- [ ] Empty states on every list page
- [ ] Error states for failed fetches
- [ ] Mobile bottom nav works
- [ ] Command palette ⌘K works (with universal search function)
- [ ] Notifications panel real-time updates work
- [ ] **Bulk actions on tables (Reassign, Change status, Export)**
- [ ] **Saved views functional**
- [ ] **Inline editing in tables**

### Security
- [ ] All admin pages reject non-admin users (test with employee account)
- [ ] No prices visible to employees (verify in DOM, not just UI)
- [ ] Webhook endpoint rejects unsigned/wrong-signature requests
- [ ] SQL injection tests pass on all forms
- [ ] CSRF protection on logout

### Performance budget
- [ ] First Contentful Paint < 1s on Dashboard
- [ ] Pipeline view smooth at 200+ cards
- [ ] Search results < 50ms after 250ms debounce
- [ ] Materialized views refresh successfully every 5 min

### Compliance
- [ ] Privacy policy page linked in login footer
- [ ] Help / contact page functional
- [ ] Activity log retention policy defined (90 days, auto-trimmed)
- [ ] Notifications archive working (30-day cutoff)
- [ ] PII handling documented

---

## What's new in v2.0

This version adds 15 mandatory production-grade improvements based on architectural review. Without these, the system would experience:

- **Slow page loads** at scale (5+ seconds on Dashboard with > 1000 orders)
- **Database connection exhaustion** (60-connection limit on direct connection)
- **N+1 query problems** in Orders table (75 queries per page)
- **Frozen UI** on slow networks (employee actions block 2-3 seconds)
- **Lag on Pipeline** view with > 200 cards
- **Bloated `notifications` table** (1.8M rows/year)
- **Lost actions for KSA team** when network drops

All of these are fixed in v2.0. See `OPTIFY_SYSTEM_PROMPT.md` §14 and `OPTIFY_DATABASE_SCHEMA.md` §11 for implementation details.

---

## Support and updates

This package was generated based on extensive design conversations between Ahmed Adel Salah (Optify.cc) and Claude (Anthropic). It represents a single source of truth for the Optify OMS as designed for Trendslet on April 27, 2026.

For updates or changes, edit the source files directly and re-generate this package.

---

**Package version:** 2.0
**Generated:** April 27, 2026
**For:** Trendslet OMS
**By:** Optify.cc
