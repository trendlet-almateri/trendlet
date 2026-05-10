-- Migration 20260429000001: supplier invoice barcode
--
-- Business model clarification: when a sourcing employee receives a supplier
-- receipt by email (e.g. an Adidas store receipt), the receipt has a SINGLE
-- barcode at the bottom representing the entire transaction — not one per
-- line item. We split that supplier receipt into multiple customer invoices
-- (one per KSA customer whose items are on it), and each customer's PDF
-- prints the SAME original supplier barcode.
--
-- The existing `supplier_invoice_items.barcode` column was modeled
-- per-item; that doesn't match how the business actually works. We're
-- not removing it (avoiding breakage of any code that may still touch
-- it), just ignoring it going forward. New code reads the barcode from
-- `supplier_invoices.barcode`.

ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS barcode text;

COMMENT ON COLUMN supplier_invoices.barcode IS
  'Single barcode (e.g. Code128 value) extracted from the supplier receipt. Reproduced verbatim on every customer invoice generated from this supplier invoice. Nullable — not all suppliers print barcodes.';
