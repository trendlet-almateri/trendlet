/* eslint-disable @typescript-eslint/no-explicit-any */
// react-pdf's JSX intrinsics conflict with React 18's JSX type narrowing in
// strict mode; the casts are localized to this single file.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
  pdf,
} from "@react-pdf/renderer";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { generateBarcodePng } from "./barcode";

/* ── Arabic font registration ─────────────────────────────────────────
   Helvetica has no Arabic glyphs. We register Noto Sans Arabic so customer
   names render correctly.

   Registration strategy: read the TTF bytes and pass as a base64 data URI.
   Avoids two failure modes that bit us in production:
     1. Filesystem path resolution (Vercel /var/task vs cwd vs app/)
     2. fontkit failing to open a path that exists but isn't readable
   With a data URI, the font travels with the code and there's no path
   layout to debug. ~825KB font held in memory once registered.

   Module-level cache so we don't re-read on every invocation. */
let arabicFontRegistered = false;
async function ensureArabicFont(): Promise<boolean> {
  if (arabicFontRegistered) return true;
  const candidates = [
    join(process.cwd(), "public", "fonts", "NotoSansArabic-Regular.ttf"),
    join(process.cwd(), "app", "public", "fonts", "NotoSansArabic-Regular.ttf"),
    "/var/task/public/fonts/NotoSansArabic-Regular.ttf",
  ];
  for (const p of candidates) {
    try {
      const bytes = await readFile(p);
      const dataUri = `data:font/ttf;base64,${bytes.toString("base64")}`;
      Font.register({ family: "NotoArabic", src: dataUri });
      arabicFontRegistered = true;
      return true;
    } catch {
      // try next
    }
  }
  console.warn(
    "[customer-invoice-pdf] NotoSansArabic-Regular.ttf not found in any of:",
    candidates,
  );
  return false;
}

const ARABIC_RANGE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
function hasArabic(s: string | null | undefined): boolean {
  return !!s && ARABIC_RANGE.test(s);
}

/* ── data shape (kept narrow — built up in approveInvoiceAction) ─────── */

export type InvoicePdfData = {
  invoice_number: string;
  generated_at: string;
  language: "en" | "ar" | "bilingual";
  customer: {
    name: string;
    email: string | null;
    address: {
      line1?: string | null;
      city?: string | null;
      country?: string | null;
    } | null;
  };
  order: {
    shopify_order_number: string | null;
  };
  // Line items. If the invoice has rows in customer_invoice_items those are
  // used; otherwise we fall back to sub_orders on the originating order.
  items: {
    title: string;
    sku: string | null;
    quantity: number;
    unit_price?: number;
    line_total?: number;
  }[];
  totals: {
    item_price: number;
    /** Discount applied to item_price before shipping + VAT. 0 if none. */
    discount_amount: number;
    shipment_fee: number;
    tax_amount: number;
    tax_percent: number;
    total: number;
    currency: string;
  };
  // The single supplier-invoice barcode (or null if the supplier didn't
  // print one). Phase 2 only reproduces the original value verbatim.
  barcode: string | null;
};

/* ── styles ──────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0f1419",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#d4d4d8",
  },
  brand: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  brandLogo: {
    width: 110,
    height: 30,
    objectFit: "contain",
  },
  meta: {
    textAlign: "right",
  },
  metaLabel: {
    fontSize: 8,
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metaValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 8,
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  customerName: {
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  customerNameArabic: {
    // No `direction: rtl` — @react-pdf/textkit's bidi reorder pass throws
    // "Cannot read properties of undefined (reading 'id')" when direction
    // is set on a Tx with our Arabic content. textkit handles Arabic glyph
    // SHAPING natively (medial/initial/final forms work without help);
    // textAlign:right gives the visual RTL flow we want.
    fontFamily: "NotoArabic",
    fontSize: 12,
    marginBottom: 2,
    textAlign: "right" as const,
  },
  customerLine: {
    fontSize: 9,
    color: "#3f3f46",
  },
  table: {
    marginTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#d4d4d8",
  },
  thead: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#d4d4d8",
    backgroundColor: "#fafafa",
  },
  thItem: { flex: 4, paddingHorizontal: 4, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#71717a", textTransform: "uppercase" },
  thQty: { flex: 1, paddingHorizontal: 4, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#71717a", textTransform: "uppercase", textAlign: "right" as const },
  row: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f4f4f5",
  },
  cellItem: { flex: 4, paddingHorizontal: 4 },
  cellSku: { fontSize: 8, color: "#71717a", marginTop: 2 },
  cellQty: { flex: 1, paddingHorizontal: 4, textAlign: "right" as const, fontFamily: "Helvetica-Bold" },
  totalsBlock: {
    marginTop: 16,
    alignSelf: "flex-end",
    width: 220,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalLabel: {
    color: "#71717a",
  },
  totalValue: {
    fontFamily: "Helvetica-Bold",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#0f1419",
  },
  grandTotalLabel: {
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    fontSize: 9,
    letterSpacing: 0.6,
  },
  grandTotalValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },
  barcodeBlock: {
    marginTop: 32,
    alignItems: "center",
  },
  barcodeImage: {
    width: 220,
    height: 60,
  },
  barcodeCaption: {
    fontSize: 7,
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    textAlign: "center",
    fontSize: 8,
    color: "#a1a1aa",
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#e4e4e7",
  },
});

/* ── currency helpers ────────────────────────────────────────────────── */

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Strip characters that fall outside both Helvetica AND Noto Sans
 * Arabic (CJK, emoji, etc.) so the PDF doesn't collapse on unsupported
 * glyphs. Arabic and Latin are both kept; the customer block picks the
 * right font per line based on hasArabic().
 */
function safeText(s: string | null | undefined): string {
  if (!s) return "";
  // Keep printable ASCII + Latin-1 supplements + Arabic blocks + common
  // punctuation. Anything else (CJK, emoji, etc.) is stripped so the
  // PDF layout doesn't collapse on unsupported glyphs.
  const ARABIC_OK = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
  const LATIN_OK = /[\x20-\x7E -ɏ‐-‧]/;
  const out: string[] = [];
  for (const ch of s) {
    if (LATIN_OK.test(ch) || ARABIC_OK.test(ch)) out.push(ch);
  }
  return out.join("").trim();
}

/* ── component ───────────────────────────────────────────────────────── */

function CustomerInvoiceDocument({
  data,
  barcodeImageDataUrl,
  logoDataUrl,
  arabicAvailable,
}: {
  data: InvoicePdfData;
  barcodeImageDataUrl: string | null;
  logoDataUrl: string | null;
  arabicAvailable: boolean;
}) {
  const { invoice_number, generated_at, customer, order, items, totals, barcode } = data;
  const Doc = Document as any;
  const Pg = Page as any;
  const Vw = View as any;
  const Tx = Text as any;
  const Img = Image as any;

  return (
    <Doc>
      <Pg size="A4" style={styles.page}>
        {/* Header */}
        <Vw style={styles.headerRow}>
          <Vw>
            {logoDataUrl ? (
              <Img src={logoDataUrl} style={styles.brandLogo} />
            ) : (
              <Tx style={styles.brand}>TRENDLET</Tx>
            )}
          </Vw>
          <Vw style={styles.meta}>
            <Tx style={styles.metaLabel}>Invoice</Tx>
            <Tx style={styles.metaValue}>{invoice_number}</Tx>
            <Tx style={[styles.metaLabel, { marginTop: 6 }]}>Issued</Tx>
            <Tx style={{ fontSize: 9, marginTop: 2 }}>{fmtDate(generated_at)}</Tx>
            {order.shopify_order_number && (
              <>
                <Tx style={[styles.metaLabel, { marginTop: 6 }]}>Order</Tx>
                <Tx style={{ fontSize: 9, marginTop: 2 }}>{order.shopify_order_number}</Tx>
              </>
            )}
          </Vw>
        </Vw>

        {/* Customer — name (Arabic-aware) + email only. Address intentionally
            omitted from the customer-facing invoice. */}
        <Vw style={styles.section}>
          <Tx style={styles.sectionLabel}>Bill to</Tx>
          {(() => {
            const cleanName = safeText(customer.name) || "Customer";
            const useArabic = arabicAvailable && hasArabic(cleanName);
            // If the Arabic font failed to register, strip Arabic from the
            // name so we don't try to render glyphs Helvetica can't draw.
            const display = useArabic ? cleanName : safeText(cleanName).replace(/[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g, "").trim() || "Customer";
            return (
              <Tx style={useArabic ? styles.customerNameArabic : styles.customerName}>
                {display}
              </Tx>
            );
          })()}
          {customer.email && (
            <Tx style={styles.customerLine}>{safeText(customer.email)}</Tx>
          )}
        </Vw>

        {/* Items table */}
        <Vw style={styles.table}>
          <Vw style={styles.thead}>
            <Tx style={styles.thItem}>Item</Tx>
            <Tx style={styles.thQty}>Qty</Tx>
            <Tx style={styles.thQty}>Unit</Tx>
            <Tx style={styles.thQty}>Line</Tx>
          </Vw>
          {items.map((item, i) => (
            <Vw key={i} style={styles.row}>
              <Vw style={styles.cellItem}>
                <Tx>{item.title}</Tx>
                {item.sku && <Tx style={styles.cellSku}>SKU {item.sku}</Tx>}
              </Vw>
              <Tx style={styles.cellQty}>{item.quantity}</Tx>
              <Tx style={styles.cellQty}>
                {item.unit_price != null ? fmt(item.unit_price, totals.currency) : "—"}
              </Tx>
              <Tx style={styles.cellQty}>
                {item.line_total != null ? fmt(item.line_total, totals.currency) : "—"}
              </Tx>
            </Vw>
          ))}
        </Vw>

        {/* Totals */}
        <Vw style={styles.totalsBlock}>
          <Vw style={styles.totalRow}>
            <Tx style={styles.totalLabel}>Items</Tx>
            <Tx style={styles.totalValue}>{fmt(totals.item_price, totals.currency)}</Tx>
          </Vw>
          {totals.discount_amount > 0 && (
            <Vw style={styles.totalRow}>
              <Tx style={styles.totalLabel}>Discount</Tx>
              <Tx style={styles.totalValue}>− {fmt(totals.discount_amount, totals.currency)}</Tx>
            </Vw>
          )}
          {totals.shipment_fee > 0 && (
            <Vw style={styles.totalRow}>
              <Tx style={styles.totalLabel}>Shipping</Tx>
              <Tx style={styles.totalValue}>{fmt(totals.shipment_fee, totals.currency)}</Tx>
            </Vw>
          )}
          {totals.tax_amount > 0 && (
            <Vw style={styles.totalRow}>
              <Tx style={styles.totalLabel}>VAT ({totals.tax_percent.toFixed(0)}%)</Tx>
              <Tx style={styles.totalValue}>{fmt(totals.tax_amount, totals.currency)}</Tx>
            </Vw>
          )}
          <Vw style={styles.grandTotalRow}>
            <Tx style={styles.grandTotalLabel}>Total</Tx>
            <Tx style={styles.grandTotalValue}>{fmt(totals.total, totals.currency)}</Tx>
          </Vw>
        </Vw>

        {/* Barcode (only when supplier provided one) */}
        {barcode && barcodeImageDataUrl && (
          <Vw style={styles.barcodeBlock}>
            <Img src={barcodeImageDataUrl} style={styles.barcodeImage} />
            <Tx style={styles.barcodeCaption}>Supplier reference</Tx>
          </Vw>
        )}

        {/* Footer */}
        <Tx style={styles.footer} fixed>
          Trendlet · Riyadh, Saudi Arabia · contact@trendlet.com
        </Tx>
      </Pg>
    </Doc>
  );
}

/* ── public renderer ─────────────────────────────────────────────────── */

/**
 * Render the invoice to a PDF Buffer ready for storage upload.
 * Generates the barcode PNG inline if a value is present on the data.
 * Loads the Trendlet logo from /public/logo.png at render time.
 */
export async function renderCustomerInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  // Register the Arabic font once per process so non-Latin customer data
  // (names, addresses) renders correctly. No-op after the first call.
  // If registration fails (font file missing, base64 read error), we
  // continue without it; safeText() will strip Arabic chars before they
  // reach a font that can't render them, so the layout still holds.
  const arabicAvailable = await ensureArabicFont();

  let barcodeImageDataUrl: string | null = null;
  if (data.barcode) {
    const png = await generateBarcodePng(data.barcode);
    barcodeImageDataUrl = `data:image/png;base64,${png.toString("base64")}`;
  }

  // Try several plausible roots — Vercel's serverless function bundles
  // the project at /var/task; local Next.js dev uses process.cwd() at the
  // app root. We attempt them in order and log the failure path on miss
  // so future deploys leave a trail.
  let logoDataUrl: string | null = null;
  const candidates = [
    join(process.cwd(), "public", "logo.png"),
    join(process.cwd(), "app", "public", "logo.png"),
    "/var/task/public/logo.png",
  ];
  for (const p of candidates) {
    try {
      const bytes = await readFile(p);
      logoDataUrl = `data:image/png;base64,${bytes.toString("base64")}`;
      break;
    } catch {
      // try next
    }
  }
  if (!logoDataUrl) {
    console.warn("[customer-invoice-pdf] logo.png not found in any of:", candidates);
  }

  const blob = await pdf(
    <CustomerInvoiceDocument
      data={data}
      barcodeImageDataUrl={barcodeImageDataUrl}
      logoDataUrl={logoDataUrl}
      arabicAvailable={arabicAvailable}
    />,
  ).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
