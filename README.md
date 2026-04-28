# Trendlet — Optify OMS

Internal Order Management System for Trendslet. Sits downstream of Shopify and orchestrates the post-purchase workflow: sourcing, US/EU warehouse, KSA last-mile.

**Status:** Phase 7 in progress. See [PROGRESS.md](./PROGRESS.md) for what's built, what's pending, and the activation checklist.

## Stack

- Next.js 14 (App Router) · TypeScript · Tailwind
- Supabase (Postgres 17 + Auth + Realtime + RLS)
- Twilio WhatsApp · Shopify webhooks
- Hubstaff / DHL / Resend (mock fallbacks until creds arrive)

## Layout

```
Trendlet/
├── app/                       # Next.js app — Vercel "Root Directory"
│   ├── app/                   # routes
│   ├── components/
│   ├── lib/
│   ├── public/
│   └── supabase/migrations/
├── PROGRESS.md                # single source of truth — read first
├── SPEC_PACKAGE.md            # original spec-package README (build docs index)
├── OPTIFY_SYSTEM_PROMPT.md    # full spec (20+ pages)
├── OPTIFY_VISUAL_REFERENCE.md # ASCII wireframes
├── OPTIFY_DATABASE_SCHEMA.md  # DB schema reference
└── CLAUDE.md                  # project rules for Claude Code
```

## Local dev

```bash
cd app
cp .env.example .env.local    # fill in real values
npm install
npm run dev                   # http://localhost:3000
```

The first run redirects to `/login`. Admin user: `ai@trendlet.com` (password set in Supabase Dashboard).

## Verify the build

```bash
cd app
npx tsc --noEmit              # 0 errors expected
npm run build                 # 24 routes compile clean
```

## Deploy to Vercel

1. Import this repo in [vercel.com/new](https://vercel.com/new)
2. Set **Root Directory** to `app`
3. Paste env vars from `app/.env.example` into Vercel project settings (Production + Preview)
4. **Plan must be Pro** (Hobby's 10s function timeout is too short for some routes)
5. Push to `main` → auto-deploys

## Activation checklist (before going live)

See [PROGRESS.md](./PROGRESS.md) → "Phase 8 (next, when ready)" section.

## Health check

Once deployed, visit `/setup/integrations` (admin only) to see live status of all 8 external services.
