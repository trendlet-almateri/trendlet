/* eslint-disable @typescript-eslint/no-explicit-any */
// react-pdf's JSX intrinsics conflict with React 18's JSX type narrowing in
// strict mode; the casts are localized to this single file (same pattern as
// customer-invoice-pdf.tsx, which this is modeled on).

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

/* ── Arabic font registration ─────────────────────────────────────────
   The tax invoice prints the Arabic category (e.g. "شنط كروس بودي"). Helvetica
   has no Arabic glyphs, so we register Noto Sans Arabic via a base64 data URI
   (avoids Vercel /var/task path-resolution issues). Unlike the customer
   invoice's customer-name block, the category is short, static text rendered
   with textAlign:right — textkit shapes Arabic glyphs natively and does not hit
   the bidi-reorder crash that block did. */
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
    "[tax-invoice-pdf] NotoSansArabic-Regular.ttf not found in any of:",
    candidates,
  );
  return false;
}

const ARABIC_RANGE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
function hasArabic(s: string | null | undefined): boolean {
  return !!s && ARABIC_RANGE.test(s);
}

/* ── data shape ──────────────────────────────────────────────────────── */

export type TaxInvoicePdfData = {
  invoice_number: string;
  generated_at: string;
  order: {
    shopify_order_number: string | null;
  };
  brand_name: string | null;
  category_ar: string | null;
  fees: {
    service_fee_net: number;
    service_fee_vat: number;
    service_fee_with_vat: number;
    shipping_customs_fee: number;
    total_fee: number;
    currency: string;
  };
};

/* ── styles (mirrors customer-invoice-pdf.tsx) ───────────────────────── */

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#0f1419" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#d4d4d8",
  },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  brandLogo: { width: 110, height: 30, objectFit: "contain" },
  docTitle: {
    fontSize: 8,
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 4,
  },
  meta: { textAlign: "right" },
  metaLabel: {
    fontSize: 8,
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metaValue: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 2 },
  section: { marginBottom: 18 },
  sectionLabel: {
    fontSize: 8,
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  detailValue: { fontFamily: "Helvetica-Bold", marginBottom: 2 },
  detailValueArabic: {
    fontFamily: "NotoArabic",
    fontSize: 12,
    marginBottom: 2,
    textAlign: "right" as const,
  },
  feeBlock: { marginTop: 8, alignSelf: "flex-end", width: 260 },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f4f4f5",
  },
  feeLabel: { color: "#71717a" },
  feeValue: { fontFamily: "Helvetica-Bold" },
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
  grandTotalValue: { fontSize: 14, fontFamily: "Helvetica-Bold" },
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

/* ── helpers ─────────────────────────────────────────────────────────── */

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

function safeText(s: string | null | undefined): string {
  if (!s) return "";
  const ARABIC_OK = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
  const LATIN_OK = /[\x20-\x7E -ɏ‐-‧]/;
  const out: string[] = [];
  for (const ch of s) {
    if (LATIN_OK.test(ch) || ARABIC_OK.test(ch)) out.push(ch);
  }
  return out.join("").trim();
}

/* ── component ───────────────────────────────────────────────────────── */

function TaxInvoiceDocument({
  data,
  logoDataUrl,
  arabicAvailable,
}: {
  data: TaxInvoicePdfData;
  logoDataUrl: string | null;
  arabicAvailable: boolean;
}) {
  const { invoice_number, generated_at, order, brand_name, category_ar, fees } = data;
  const Doc = Document as any;
  const Pg = Page as any;
  const Vw = View as any;
  const Tx = Text as any;
  const Img = Image as any;

  const categoryIsArabic = arabicAvailable && hasArabic(category_ar);

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
            <Tx style={styles.docTitle}>Tax Invoice</Tx>
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

        {/* Brand + category */}
        <Vw style={styles.section}>
          <Tx style={styles.sectionLabel}>Item</Tx>
          {brand_name && <Tx style={styles.detailValue}>{safeText(brand_name)}</Tx>}
          {category_ar && (
            <Tx style={categoryIsArabic ? styles.detailValueArabic : styles.detailValue}>
              {safeText(category_ar)}
            </Tx>
          )}
        </Vw>

        {/* Fee breakdown */}
        <Vw style={styles.feeBlock}>
          <Vw style={styles.feeRow}>
            <Tx style={styles.feeLabel}>Service fee (net)</Tx>
            <Tx style={styles.feeValue}>{fmt(fees.service_fee_net, fees.currency)}</Tx>
          </Vw>
          <Vw style={styles.feeRow}>
            <Tx style={styles.feeLabel}>VAT (15%)</Tx>
            <Tx style={styles.feeValue}>{fmt(fees.service_fee_vat, fees.currency)}</Tx>
          </Vw>
          <Vw style={styles.feeRow}>
            <Tx style={styles.feeLabel}>Service fee (incl. VAT)</Tx>
            <Tx style={styles.feeValue}>{fmt(fees.service_fee_with_vat, fees.currency)}</Tx>
          </Vw>
          <Vw style={styles.feeRow}>
            <Tx style={styles.feeLabel}>Shipping &amp; customs</Tx>
            <Tx style={styles.feeValue}>{fmt(fees.shipping_customs_fee, fees.currency)}</Tx>
          </Vw>
          <Vw style={styles.grandTotalRow}>
            <Tx style={styles.grandTotalLabel}>Total</Tx>
            <Tx style={styles.grandTotalValue}>{fmt(fees.total_fee, fees.currency)}</Tx>
          </Vw>
        </Vw>

        {/* Footer */}
        <Tx style={styles.footer} fixed>
          Trendlet · Riyadh, Saudi Arabia · contact@trendlet.com
        </Tx>
      </Pg>
    </Doc>
  );
}

/* ── public renderer ─────────────────────────────────────────────────── */

export async function renderTaxInvoicePdf(data: TaxInvoicePdfData): Promise<Buffer> {
  const arabicAvailable = await ensureArabicFont();

  // Logo: try the same roots the customer invoice does (Vercel bundles at
  // /var/task; local dev resolves from process.cwd()).
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
    console.warn("[tax-invoice-pdf] logo.png not found in any of:", candidates);
  }

  const blob = await pdf(
    <TaxInvoiceDocument
      data={data}
      logoDataUrl={logoDataUrl}
      arabicAvailable={arabicAvailable}
    />,
  ).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
