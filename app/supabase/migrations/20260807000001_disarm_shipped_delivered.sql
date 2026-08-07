-- Applied to production 2026-08-06 as a data update; committed 2026-08-07 so a
-- database rebuilt from migrations matches production.
--
-- THIS ONE MATTERS ON A REBUILD. The seed arms both statuses. Without this
-- migration a fresh database would send two messages for the same event:
--
--   'shipped'   duplicated dhl_departed_usa
--               ("تم شحن طلبك إلى السعودية" vs "طلبك حلّق باتجاه السعودية")
--   'delivered' duplicated dhl_arrived_ksa
--               ("تم توصيل طلبك إلى السعودية")
--
-- Staff messaging now stops at the warehouse hand-off; DHL owns the journey
-- from pickup to the Riyadh office, and dhl_at_trendlet_hq is the final
-- customer message.
--
-- It is also load-bearing for the board automation: the DHL poller writes both
-- statuses, and that write fires the status-change notify trigger. If either
-- were re-armed, every customer would get the DHL message AND the status
-- message. scripts/check-dhl-pipeline.mts asserts they stay silent.
--
-- Both remain fully usable as workflow states — only the messaging is off.
update public.statuses
set notifies_customer = false
where key in ('shipped', 'delivered');
