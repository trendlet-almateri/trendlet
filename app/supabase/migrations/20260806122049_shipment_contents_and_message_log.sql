-- Applied to production 2026-08-06. Committed after the fact so the repo
-- describes the live schema.
--
-- Which customer orders are inside a DHL shipment. One bulk shipment from the
-- US carries many customers' sub-orders, which is why status notifications
-- could not be sent: there was no way to know whose phone to message.
create table if not exists public.shipment_sub_orders (
  shipment_id  uuid not null references public.shipments(id) on delete cascade,
  sub_order_id uuid not null references public.sub_orders(id) on delete cascade,
  added_at     timestamptz not null default now(),
  primary key (shipment_id, sub_order_id)
);

create index if not exists shipment_sub_orders_sub_order_idx
  on public.shipment_sub_orders (sub_order_id);

-- Ledger of DHL status messages already sent. The UNIQUE constraint is the
-- real once-only guarantee: the poller recomputes the full message plan on
-- every run, and an insert conflict is what stops a customer being messaged
-- twice for the same milestone. Manual sends from the shipment page write the
-- same table, so manual and automatic can never both fire.
create table if not exists public.shipment_message_log (
  id           uuid primary key default gen_random_uuid(),
  shipment_id  uuid not null references public.shipments(id) on delete cascade,
  sub_order_id uuid not null references public.sub_orders(id) on delete cascade,
  message_key  text not null,
  twilio_sid   text,
  sent_at      timestamptz not null default now(),
  unique (shipment_id, sub_order_id, message_key)
);

alter table public.shipment_sub_orders enable row level security;
alter table public.shipment_message_log enable row level security;

-- Staff read shipment contents through the app; writes are service-role only.
drop policy if exists shipment_sub_orders_read on public.shipment_sub_orders;
create policy shipment_sub_orders_read on public.shipment_sub_orders
  for select to authenticated using (true);
