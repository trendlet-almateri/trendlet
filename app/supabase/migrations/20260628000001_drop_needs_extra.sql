-- Retire the needs_extra flag: products with no custom.extra now default to
-- 300 SAR in the calc, so there's always a value and nothing to flag.
alter table tax_invoices drop column if exists needs_extra;
