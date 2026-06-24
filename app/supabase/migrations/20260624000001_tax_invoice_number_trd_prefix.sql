-- Tax-invoice numbering: TAX-<year>-<4-digit>  →  TRD-<year>-<5-digit>.
-- Applied to live DB kfrjqpjprvvsibwmrqph; existing rows renumbered + their
-- stale PDF paths nulled so they re-render with the new number + new template.

CREATE OR REPLACE FUNCTION public.next_tax_invoice_sequence(p_year integer)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO tax_invoice_sequences (year, last_used_number)
  VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_used_number = tax_invoice_sequences.last_used_number + 1
  RETURNING last_used_number INTO v_next;

  RETURN format('TRD-%s-%s', p_year, lpad(v_next::text, 5, '0'));
END;
$function$;

UPDATE tax_invoices
SET invoice_number = regexp_replace(invoice_number, '^TAX-(\d{4})-(\d+)$',
      'TRD-\1-' || lpad((regexp_replace(invoice_number, '^TAX-\d{4}-', ''))::int::text, 5, '0')),
    pdf_storage_path = NULL,
    updated_at = now()
WHERE invoice_number LIKE 'TAX-%';
