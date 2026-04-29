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
  pdf,
} from "@react-pdf/renderer";
import { generateBarcodePng } from "./barcode";

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
  // Line items: one per sub_order on the originating order.
  items: {
    title: string;
    sku: string | null;
    quantity: number;
  }[];
  totals: {
    item_price: number;
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
  brandSub: {
    fontSize: 9,
    color: "#71717a",
    marginTop: 2,
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

/* ── component ───────────────────────────────────────────────────────── */

function CustomerInvoiceDocument({
  data,
  barcodeImageDataUrl,
}: {
  data: InvoicePdfData;
  barcodeImageDataUrl: string | null;
}) {
  const { invoice_number, generated_at, customer, order, items, totals, barcode } = data;
  const addr = customer.address;
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
            <Tx style={styles.brand}>TRENDSLET</Tx>
            <Tx style={styles.brandSub}>Sourcing &amp; fulfillment, KSA</Tx>
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

        {/* Customer */}
        <Vw style={styles.section}>
          <Tx style={styles.sectionLabel}>Bill to</Tx>
          <Tx style={styles.customerName}>{customer.name}</Tx>
          {customer.email && <Tx style={styles.customerLine}>{customer.email}</Tx>}
          {addr?.line1 && <Tx style={styles.customerLine}>{addr.line1}</Tx>}
          {(addr?.city || addr?.country) && (
            <Tx style={styles.customerLine}>
              {[addr?.city, addr?.country].filter(Boolean).join(", ")}
            </Tx>
          )}
        </Vw>

        {/* Items table */}
        <Vw style={styles.table}>
          <Vw style={styles.thead}>
            <Tx style={styles.thItem}>Item</Tx>
            <Tx style={styles.thQty}>Qty</Tx>
          </Vw>
          {items.map((item, i) => (
            <Vw key={i} style={styles.row}>
              <Vw style={styles.cellItem}>
                <Tx>{item.title}</Tx>
                {item.sku && <Tx style={styles.cellSku}>SKU {item.sku}</Tx>}
              </Vw>
              <Tx style={styles.cellQty}>{item.quantity}</Tx>
            </Vw>
          ))}
        </Vw>

        {/* Totals */}
        <Vw style={styles.totalsBlock}>
          <Vw style={styles.totalRow}>
            <Tx style={styles.totalLabel}>Items</Tx>
            <Tx style={styles.totalValue}>{fmt(totals.item_price, totals.currency)}</Tx>
          </Vw>
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
          Trendslet · Riyadh, Saudi Arabia · contact@trendlet.com
        </Tx>
      </Pg>
    </Doc>
  );
}

/* ── public renderer ─────────────────────────────────────────────────── */

/**
 * Render the invoice to a PDF Buffer ready for storage upload.
 * Generates the barcode PNG inline if a value is present on the data.
 */
export async function renderCustomerInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  let barcodeImageDataUrl: string | null = null;
  if (data.barcode) {
    const png = await generateBarcodePng(data.barcode);
    barcodeImageDataUrl = `data:image/png;base64,${png.toString("base64")}`;
  }

  const blob = await pdf(
    <CustomerInvoiceDocument data={data} barcodeImageDataUrl={barcodeImageDataUrl} />,
  ).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
