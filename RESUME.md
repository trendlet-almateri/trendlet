# How to resume this build in a new Claude Code window

Paste this into the new chat as the first message:

---

Resume the Trendlet Optify OMS build.

**Read these in order:**
1. `d:\claude code project\Trendlet\PROGRESS.md` — full history of phases 1–7
2. `d:\claude code project\Trendlet\CLAUDE.md` — project rules (WAT framework, edit policy, 95% confidence)
3. `d:\claude code project\Trendlet\OPTIFY_SYSTEM_PROMPT.md` — full spec
4. This file (`RESUME.md`) — current deployment state

**Current state (2026-04-28, post audit pass):**

- ✅ Phases 1–6 code-complete, Phase 7 partial
- ✅ GitHub repo: https://github.com/trendlet-almateri/trendlet (private, you have token in `.env.local`)
- 🆕 **Vercel project deleted by user.** Re-import pending. See "Re-import checklist" below.
- 🆕 **Audit pass applied:** RLS hardened (jwt_is_admin), webhook replay protection, invitation acceptance flag, query limits added. All committed locally — push when ready to redeploy.
- 🔴 Known dead credentials (per `/setup/integrations` health page): `SHOPIFY_ACCESS_TOKEN` (HTTP 401), `OPENAI_API_KEY` (HTTP 401). Webhook secret is fine.
- ⚪ Mock-mode (no creds): DHL, Hubstaff, Resend
- 🟢 Working: Supabase, Twilio (account active, 0/15 template SIDs in DB), OpenRouter

**Migrations needing `supabase db push` BEFORE next deploy:**
- `20260428000002_rls_jwt_admin_full.sql` — converts remaining `is_admin()` policies to `jwt_is_admin()`
- `20260428000003_webhook_deliveries.sql` — adds dedup table for Shopify webhook replay protection

After applying migrations, regenerate types:
```
supabase gen types typescript --project-id kfrjqpjprvvsibwmrqph > app/lib/types/database.ts
```
(The webhook handler casts `webhook_deliveries` to `any` until that's done.)

**Re-import checklist (do BEFORE clicking Deploy in Vercel):**

| Vercel field | Value |
|---|---|
| Root Directory | `app` (NOT blank, NOT `./`) |
| Framework Preset | Next.js |
| Build / Install / Output | (leave defaults) |
| Node.js Version | 20.x |

**Required env vars (6 minimum to boot):**
```
NEXT_PUBLIC_SUPABASE_URL          (from app/.env.local)
NEXT_PUBLIC_SUPABASE_ANON_KEY     (from app/.env.local)
SUPABASE_SERVICE_ROLE_KEY         (from app/.env.local)
SHOPIFY_WEBHOOK_SECRET            (from app/.env.local)
NEXT_PUBLIC_APP_URL               https://trendlet.vercel.app
CRON_SECRET                       (from app/.env.local or regenerate via openssl rand -base64 32)
```

**Optional / mock-mode env vars:** Twilio (3), OpenRouter (2), DHL (2), Hubstaff (1), Resend (1), Shopify api/secret/access-token/shop-domain, NEXTAUTH_SECRET, NEXT_PUBLIC_APP_ENV, SMTP_*, TRENDLET_STORE_ID. Set when ready to flip features live.

**NEVER paste these into Vercel:** `github_token`, `vercel_apikey` (dev-only).

**Active git config in this repo:**
- author: `ai-4275 <ai@trendlet.com>` (matches Vercel project owner — required by Hobby plan)
- remote: `https://github.com/trendlet-almateri/trendlet.git`
- gh CLI authenticated as `trendlet-almateri` via OS keyring
- credential helper: `gh auth setup-git` already done

**Tokens in `app/.env.local`:**
- `github_token=...` (PAT for repo access; gh CLI uses keyring, not this file)
- `vercel_apikey=...` (heavily scoped — can't create projects, can read user identity only)

**Vercel-specific gotchas already learned:**
- Hobby plan: only daily crons. `vercel.json` is currently `0 4 * * *`.
- Hobby plan: blocks deploys whose commit author isn't a project member. Always commit as `ai@trendlet.com`.
- Edge runtime middleware can't import `@supabase/ssr` — no middleware in the repo right now (auth gating lives in server-component layouts).
- Project is behind Vercel SSO (Deployment Protection ON) — public visitors see 401 until they sign in to Vercel.

**Status:** Vercel project deleted on 2026-04-28. Local `next build` is green (22/22 routes). The previous 404-on-root issue was almost certainly Root Directory mis-set — fixed by re-importing with the cheat sheet above.

**What NOT to do (per PROGRESS.md "do not" rules):**
- Don't run paid scripts without confirmation
- Don't add a Settings page in sidebar
- Don't commit `.env.local`
- Don't write back to Shopify
- Don't use `is_admin()` in RLS — use `jwt_is_admin()`
- Don't change git author away from `ai@trendlet.com` in this repo
