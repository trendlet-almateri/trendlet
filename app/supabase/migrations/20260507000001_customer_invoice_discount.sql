-- Discount applied to a customer invoice (e.g. Shopify order-level discount).
-- Subtracted from item_price before tax + shipping in the total computation.
ALTER TABLE customer_invoices
  ADD COLUMN discount_amount numeric(12,2) NOT NULL DEFAULT 0;
