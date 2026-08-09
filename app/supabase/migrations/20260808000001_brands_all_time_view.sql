-- Every brand we have ever had orders with, all time.
--
-- A plain view, not materialized: the aggregate is over a few hundred
-- sub-orders, so it costs nothing to compute live and is always current —
-- unlike mv_top_brands_30d, which is 15 minutes stale by design and only
-- covers a rolling month. That window hides the long tail: Micheal Kors is
-- the largest brand by volume all-time but barely registers in 30 days.
create or replace view public.v_brands_all_time as
select
  b.id                              as brand_id,
  b.name                            as brand_name,
  o.currency,
  count(distinct so.id)::int        as items_count,
  count(distinct so.order_id)::int  as orders_count,
  sum(so.unit_price * so.quantity)  as revenue
from public.sub_orders so
join public.orders o on o.id = so.order_id
join public.brands b on b.id = so.brand_id
group by b.id, b.name, o.currency;

grant select on public.v_brands_all_time to authenticated;
