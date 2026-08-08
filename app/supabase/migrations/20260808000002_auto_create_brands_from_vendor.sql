-- Unknown Shopify vendors become brands instead of vanishing.
--
-- Previously an unmatched vendor left sub_orders.brand_id NULL, so the item
-- disappeared from every brand view — 167 sub-orders (39% of all items) were
-- lost this way, including 21 Burberry, 12 Kurt Geiger and 80 Trendlet.
--
-- Deliberately does NOT use the fuzzy similarity() step that
-- match_brand_from_vendor applies. Measured against live data, fuzzy absorbs
-- genuinely distinct brands: "DKNY Outlet" scores 0.42 against "DKNY" and
-- "Coach Kids" scores 0.55 against "Coach". An outlet is a separate brand with
-- its own employee assignment — the brands table already holds Coach and Coach
-- Outlet as distinct rows — so absorbing it is wrong. An unknown vendor becomes
-- its own brand; a genuine typo is merged afterwards by adding it to the target
-- brand's aliases.
create or replace function public.match_or_create_brand_from_vendor(p_vendor text)
returns uuid
language plpgsql
as $$
declare
  v_brand_id uuid;
  v_name citext;
begin
  if p_vendor is null or btrim(p_vendor) = '' then
    return null;
  end if;
  v_name := btrim(p_vendor)::citext;

  -- Exact name (citext, so case-insensitive).
  select id into v_brand_id from public.brands where name = v_name limit 1;
  if v_brand_id is not null then return v_brand_id; end if;

  -- Explicit alias — the supported way to merge a typo into a real brand.
  select id into v_brand_id from public.brands where v_name = any(aliases) limit 1;
  if v_brand_id is not null then return v_brand_id; end if;

  -- New brand. ON CONFLICT covers concurrent webhooks racing on the same vendor.
  insert into public.brands (name, notes)
  values (v_name, 'Auto-created from Shopify vendor')
  on conflict (name) do update set updated_at = now()
  returning id into v_brand_id;

  return v_brand_id;
end;
$$;

-- Backfill: create a brand for every vendor that had none, link the orphaned
-- sub-orders, and assign where the brand already has a primary owner. New
-- brands have no owner, so their items stay flagged unassigned for admin.
insert into public.brands (name, notes)
select distinct btrim(brand_name_raw)::citext, 'Auto-created from Shopify vendor (backfill)'
from public.sub_orders
where brand_id is null and brand_name_raw is not null and btrim(brand_name_raw) <> ''
on conflict (name) do nothing;

update public.sub_orders so
set brand_id = b.id
from public.brands b
where so.brand_id is null
  and so.brand_name_raw is not null
  and btrim(so.brand_name_raw)::citext = b.name;

update public.sub_orders so
set assigned_employee_id = ba.user_id, is_unassigned = false
from public.brand_assignments ba
where so.brand_id = ba.brand_id
  and ba.is_primary
  and so.assigned_employee_id is null;

-- Adds owner info so the dashboard can flag brands nobody is responsible for.
-- A brand with no primary assignment leaves every one of its items unassigned,
-- which is invisible until someone goes looking.
create or replace view public.v_brands_all_time as
select
  b.id                              as brand_id,
  b.name                            as brand_name,
  o.currency,
  count(distinct so.id)::int        as items_count,
  count(distinct so.order_id)::int  as orders_count,
  sum(so.unit_price * so.quantity)  as revenue,
  exists (
    select 1 from public.brand_assignments ba
    where ba.brand_id = b.id and ba.is_primary
  )                                 as has_owner
from public.sub_orders so
join public.orders o on o.id = so.order_id
join public.brands b on b.id = so.brand_id
group by b.id, b.name, o.currency;

grant select on public.v_brands_all_time to authenticated;
