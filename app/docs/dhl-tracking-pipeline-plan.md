# DHL Tracking Pipeline — Implementation Plan

> Status: **PLAN — awaiting approval. No code written yet.**
> Goal: see DHL shipment status in the app **without manually entering tracking numbers**.

## Constraint that shapes everything

DHL Express has **no "list my shipments" API** and **no account-level push** (verified against
DHL docs 2026-05-19). The only way to get "no manual entry" is:

**capture the tracking number automatically the moment a label is created → store it →
auto-poll its status on a schedule via the proven Pull API.**

The Pull API is confirmed working: `GET https://api-eu.dhl.com/track/shipments?trackingNumber=<n>`,
header `DHL-API-Key: <DHL_API_KEY>` (key only; secret unused), Production EU, 250 req/day.

## Where it hooks into the existing system

The shipment pipeline already exists in `sub-order-transitions.ts`:
`delivered_to_warehouse → shipped → delivered`. **No code currently runs when a sub-order
becomes `shipped`** — that transition is the natural creation point. The `shipments` table
already has every column needed (`tracking_number`, `status`, `shipped_at`, `delivered_at`,
`carrier_id`, `label_storage_path`). It is currently empty (0 rows).

## The four pieces (each independently verifiable)

### 1. Label creation on "mark shipped"  → verify: a `shipments` row appears with a real DHL tracking #
- When warehouse advances a sub-order `delivered_to_warehouse → shipped`, call DHL to create
  the Express label.
- **BLOCKER (pre-existing, external):** label creation = MyDHL Express API, which needs a valid
  DHL **account number**. Prior sessions hit DHL error 998 ("account not found"); the dev-portal
  Tracking app does NOT provide one. **This piece cannot be completed until DHL issues a usable
  Express account number.** Until then, fall back to piece 1b.
- 1b (fallback, no account # needed): a minimal admin/warehouse field to **paste the DHL
  tracking number** when marking shipped (read from the MyDHL portal). Captures the number into
  `shipments` so pieces 3–4 work today. This is the pragmatic path given the account-# blocker.

### 2. `trackDhlShipment(trackingNumber)` function  → verify: returns parsed status for #3538433006
- New function in `lib/integrations/dhl.ts` (separate from the mock `createDhlLabel`).
- `GET` Pull API with `DHL-API-Key` header. Maps DHL response → `{ statusCode, status,
  description, timestamp, location, events[], estimatedDelivery }`.
- Goes through the existing `apiCall()` wrapper (metadata-only logging, no bodies/secrets).
- Reconcile the wrong 2026-05-19 edits (Key/Secret + Basic auth) that were aimed at the wrong endpoint.

### 3. Scheduled auto-poll  → verify: a non-terminal shipment's status updates without manual action
- A cron route (`/api/cron/track-shipments`, guarded by existing `CRON_SECRET`) that:
  - selects `shipments` rows whose status is NOT terminal (delivered/cancelled/returned),
  - calls `trackDhlShipment` for each, updates `status` / `shipped_at` / `delivered_at`,
  - **hard internal cap (~200/250 req/day)** so an unattended job can't exhaust quota
    (volume is ~10 shipments/month → cap never triggers, but protects vs retry storms).
  - skips terminal shipments (no wasted calls).

### 4. Shipments page shows live status  → verify: page reflects DHL data, not mock
- The page already reads the `shipments` table. Once pieces 1b+3 populate it, it works as-is.
- Add: per-row "Refresh now" action (manual single poll) + a soft "X/250 today" counter
  from `api_logs` (never blocks manual actions).

## Sequencing recommendation

Build **2 → 1b → 3 → 4**. This delivers visible value fast without depending on the
DHL-account-number blocker:
- Piece 2 alone = prove tracking works in-app (we already proved it manually).
- Piece 1b = get real numbers into the system today (paste-on-ship), no DHL account # needed.
- Pieces 3+4 = automation + display.
Piece 1 (auto-label-creation) is added later, only once/if DHL provides the Express account number.

## What I will NOT do without further approval
- No DB schema changes (the table already fits — confirm before any migration).
- No deploy / git push (outward-facing; user-driven).
- No new env vars (key already in `.env.local`; needs adding to Vercel for prod runtime).

## Open questions for the user
1. Is the **paste-on-ship** fallback (1b) acceptable as the near-term path, given DHL Express
   label-creation is blocked on the missing account number?
2. Auto-poll cadence? (default proposal: every 6h for non-terminal shipments)
3. Should manual "Refresh now" be admin-only, or warehouse too?
