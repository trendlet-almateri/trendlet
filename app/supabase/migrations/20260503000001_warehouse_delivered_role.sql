-- Migration 20260503000001: warehouse can mark delivered (NO-OP)
--
-- Verified against production DB on 2026-05-03 — the live `statuses` row
-- for `delivered` already has warehouse in allowed_from_roles. The change
-- was applied directly in the Supabase dashboard at some earlier point
-- (recorded as schema_migrations version 20260430132800), bypassing the
-- repo migration history.
--
-- This file is left as a tombstone so the migration timeline reflects
-- the spec change, but the UPDATE is a no-op when run against current
-- production. If you ever rebuild the DB from migration files alone
-- (e.g. `supabase db reset`), this UPDATE is what gets the live state
-- back in sync.
--
-- See also: there is at least one other dashboard-only change (Twilio
-- template SIDs populated on the statuses table) that is not yet
-- captured in any migration file. Audit pending.

UPDATE statuses
   SET allowed_from_roles = ARRAY['ksa_operator','warehouse','fulfiller','admin']::user_role[]
 WHERE key = 'delivered'
   AND NOT ('warehouse' = ANY(allowed_from_roles));
