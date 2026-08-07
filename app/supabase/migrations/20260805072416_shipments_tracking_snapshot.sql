-- Applied to production 2026-08-05. Committed after the fact so the repo
-- describes the live schema.
--
-- Keep our own copy of the last successful DHL tracking result. DHL serves live
-- tracking for only a few months after delivery, then answers 404 — at which
-- point the event timeline was lost forever, because only the summary columns
-- were stored. The snapshot lets the shipment page keep showing the full history
-- after DHL forgets it.
alter table public.shipments
  add column if not exists tracking_snapshot jsonb,
  add column if not exists tracking_synced_at timestamptz;
