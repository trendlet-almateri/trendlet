-- Customer WhatsApp notifications: fire from the DATABASE, not the request
-- path. Any writer (server action, stale client on an old deployment, direct
-- SQL, future tools) that changes sub_orders.status now triggers a pg_net
-- POST to /api/internal/notify-status on the current production deployment.
--
-- Why: notifications used to fire only inside setSubOrderStatusAction. Staff
-- and admin sessions running stale clients executed OLD deployment code whose
-- env snapshot lacked a working Twilio config, so status changes saved but
-- notifications silently skipped. The DB is the single point every write
-- passes through — so the trigger lives here.
--
-- NOTE: the Authorization header value below is a placeholder. The applied
-- version uses the live SUPABASE_SERVICE_ROLE_KEY (never committed).

create extension if not exists pg_net;

create or replace function public.notify_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform net.http_post(
      url     := 'https://trendlet.vercel.app/api/internal/notify-status',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer __SERVICE_ROLE_KEY__'
      ),
      body    := jsonb_build_object(
        'sub_order_id', new.id,
        'status',       new.status
      )
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
