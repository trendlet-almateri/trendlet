-- Applied to production 2026-08-01. Committed after the fact so the repo
-- describes the live schema.
--
-- Track WhatsApp send attempts per customer invoice so a persistently failing
-- send is retried a bounded number of times instead of forever. whatsapp_sent_at
-- already existed but was never written; it now records a confirmed send and is
-- what stops any further retry.
alter table public.customer_invoices
  add column if not exists whatsapp_attempts integer not null default 0;

-- The retry sweep looks for: PDF present, never sent, attempts under the cap.
create index if not exists customer_invoices_whatsapp_pending_idx
  on public.customer_invoices (created_at desc)
  where pdf_storage_path is not null and whatsapp_sent_at is null;
