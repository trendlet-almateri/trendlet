-- Row-level flag so the tax-invoice list can show "needs extra" without a
-- per-card Shopify metafield lookup. Set by generate/regenerate from the
-- computed breakdown.missing_extra.
alter table tax_invoices add column if not exists needs_extra boolean not null default false;
