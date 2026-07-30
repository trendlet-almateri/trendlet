-- Replace the bearer-secret design of 20260730000001 with one-time nonces so
-- the trigger definition contains NO secret. The trigger inserts a random
-- nonce row and posts only the nonce; /api/internal/notify-status consumes
-- (deletes) it with the service client and then sends the notification.

create extension if not exists pg_net;

create table if not exists public.notify_nonces (
  nonce        uuid primary key default gen_random_uuid(),
  sub_order_id uuid not null,
  status       text not null,
  created_at   timestamptz not null default now()
);

-- No policies on purpose: RLS on + none defined = only the service role
-- (which bypasses RLS) can touch this table.
alter table public.notify_nonces enable row level security;

create or replace function public.notify_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n uuid;
begin
  if new.status is distinct from old.status then
    insert into public.notify_nonces (sub_order_id, status)
    values (new.id, new.status)
    returning nonce into n;

    perform net.http_post(
      url     := 'https://trendlet.vercel.app/api/internal/notify-status',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object('nonce', n)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_status_change on public.sub_orders;
create trigger trg_notify_status_change
  after update of status on public.sub_orders
  for each row
  execute function public.notify_status_change();
