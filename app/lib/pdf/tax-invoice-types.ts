/** Shared types for the tax-invoice PDF (rendered HTML→Chrome). */

export type TaxInvoiceLineItem = {
  /** Product title, may be bilingual e.g. "حقيبة يد جلدية – Stella McCartney". */
  title: string;
  /** Variant subtitle e.g. "موديل Mini Falabella · أسود". */
  variant_title: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type TaxInvoicePdfData = {
  invoice_number: string;
  issue_date: string; // ISO
  due_date: string; // ISO
  order: {
    shopify_order_number: string | null;
  };
  customer: {
    name: string;
    phone: string | null;
    city: string | null;
    payment_method: string | null;
  };
  line_items: TaxInvoiceLineItem[];
  totals: {
    subtotal: number;
    discount: number; // positive; rendered as negative
    grand_total: number;
    currency: string;
  };
  payment: {
    paid: boolean;
    method: string | null;
    paid_at: string | null; // ISO
  };
  /**
   * Tax-invoice ONLY breakdown of the existing total (computed from each
   * product's `custom.extra` metafield). Omitted on customer invoices, where
   * these lines must not appear. The grand total is unchanged — this only
   * explains its composition:
   *   per item: profit = 70 (fixed), shipping = max(0, extra - 70),
   *             vat = profit * 0.15
   * Values here are summed across all items × quantity.
   */
  breakdown?: {
    shipping: number; // Σ max(0, extra-70) × qty
    profit: number;   // 70 × total qty
    vat: number;      // Σ (profit × 0.15) × qty — shown BELOW the total
  };
};
