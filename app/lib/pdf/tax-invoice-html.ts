/**
 * HTML template for the customer-facing simplified tax invoice
 * (فاتورة ضريبية مبسطة). Rendered to PDF via headless Chrome (see
 * tax-invoice-pdf.tsx). Browser bidi handles mixed Arabic + Latin perfectly,
 * which is why we render from HTML rather than react-pdf.
 *
 * Layout mirrors the approved Trendlet sample (Trendlet/invoice-preview.html).
 */

import type { TaxInvoicePdfData } from "./tax-invoice-types";
export type { TaxInvoicePdfData, TaxInvoiceLineItem } from "./tax-invoice-types";

/* ── escaping + formatting ───────────────────────────────────────────── */

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const NOTES = [
  "بإتمام هذا الطلب يقر العميل بأنه اطلع ووافق على الشروط والأحكام وسياسات متجر تريندلت.",
  "يقر العميل بأنه فوض متجر تريندلت بالشراء نيابة عنه وفقاً للمنتج والمواصفات التي اختارها بنفسه.",
  "يقر العميل بأن متجر تريندلت يقدم خدمة الشراء بالنيابة عن الغير وفق المنتج والمواصفات التي اختارها بنفسه.",
  "السعر الموضح في هذه الفاتورة هو السعر النهائي المستحق للطلب شامل ضريبة القيمة المضافة وكافة التكاليف المرتبطة بتنفيذ الطلب.",
  "تخضع عمليات الإلغاء والاستبدال والاسترجاع للشروط والأحكام المنشورة على الموقع الإلكتروني: trendlet.com/policies/terms-of-service",
];

/* ── template ────────────────────────────────────────────────────────── */

/**
 * Build the full HTML document for one invoice.
 * @param data       invoice data
 * @param _logoDataUrl kept for signature stability; the header uses a black
 *                    "trendlet" wordmark rather than an image.
 */
export function renderTaxInvoiceHtml(
  data: TaxInvoicePdfData,
  _logoDataUrl: string | null,
  arabicFontDataUrl: string | null = null,
): string {
  const { invoice_number, issue_date, due_date, order, customer, line_items, totals, payment, breakdown } = data;

  // Trendlet logo: gold bracket mark + black "trendlet" wordmark. Rendered in an
  // LTR flex row (isolated from the page's RTL flow) so the mark sits left of the
  // word. Recreated inline so the PDF stays self-contained.
  const logoHtml = `<span style="display:inline-flex;align-items:center;gap:8px;direction:ltr">
    <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 26 Q14 14 26 14 L50 14 L50 33 L33 33 Q31 33 31 35 L31 65 Q31 67 33 67 L50 67 L50 86 L26 86 Q14 86 14 74 Z" fill="#c9a13b"/>
      <path d="M58 14 L74 14 Q86 14 86 26 L86 74 Q86 86 74 86 L58 86 L58 67 L67 67 Q69 67 69 65 L69 35 Q69 33 67 33 L58 33 Z" fill="#c9a13b"/>
    </svg>
    <span style="font-size:22px;font-weight:800;color:#0f1419;letter-spacing:-0.5px">trendlet</span>
  </span>`;

  const rows = line_items
    .map(
      (item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="col-product">
          <div class="product-name">${esc(item.title)}</div>
          ${item.variant_title ? `<div class="product-sub">${esc(item.variant_title)}</div>` : ""}
        </td>
        <td>${item.quantity}</td>
        <td>${money(item.unit_price)}</td>
        <td>${money(item.line_total)}</td>
      </tr>`,
    )
    .join("");

  const discountRow =
    totals.discount > 0
      ? `<div class="totals-row-line">
           <span class="t-value discount"><span class="sar">ر.س</span> ${money(totals.discount)}-</span>
           <span class="t-label">الخصم</span>
         </div>`
      : "";

  // Tax-invoice breakdown lines (shipping + profit) shown inside the totals
  // block, between المجموع/الخصم and the grand total. Omitted on customer
  // invoices (no breakdown passed).
  const breakdownRows = breakdown
    ? `<div class="totals-row-line">
         <span class="t-value"><span class="sar">ر.س</span> ${money(breakdown.shipping)}</span>
         <span class="t-label">رسوم الشحن</span>
       </div>
       <div class="totals-row-line">
         <span class="t-value"><span class="sar">ر.س</span> ${money(breakdown.profit)}</span>
         <span class="t-label">الربح (رسوم الخدمة)</span>
       </div>`
    : "";

  // VAT line shown BELOW the grand total (15% of the profit, "to be remitted").
  const vatRow = breakdown
    ? `<div class="vat-below">
         <span class="t-value"><span class="sar">ر.س</span> ${money(breakdown.vat)}</span>
         <span class="t-label">ضريبة القيمة المضافة (15%)</span>
       </div>`
    : "";

  const paymentText = payment.paid
    ? `تم الدفع${payment.method ? ` عبر ${esc(payment.method)}` : ""}${payment.paid_at ? ` بتاريخ ${fmtDate(payment.paid_at)}` : ""}`
    : "";

  const paymentSection = payment.paid
    ? `<div class="payment-status">
         <div class="pay-info">
           <div class="pay-heading">حالة الدفع</div>
           <p>${paymentText}</p>
         </div>
         <span class="paid-pill">مدفوعة بالكامل</span>
       </div>`
    : "";

  const notesHtml = NOTES.map((n) => `<li>${esc(n)}</li>`).join("");

  // Per-sub-order invoices show the sub-order number (#1514-01); tax invoices
  // fall back to the order number (#1514).
  const orderLabel = order.sub_order_number ?? order.shopify_order_number;
  const orderRow = orderLabel
    ? `<div class="info-row"><span class="info-label">رقم الطلب</span><span class="info-value ltr-value">#${esc(orderLabel)}</span></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<style>
  ${arabicFontDataUrl ? `@font-face {
    font-family: 'NotoArabic';
    src: url('${arabicFontDataUrl}') format('truetype');
    font-weight: normal;
  }` : ""}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  /* NotoArabic first so Arabic glyphs always render in headless Chrome (which
     ships no Arabic font); Latin falls through to the sans-serif stack. */
  body { font-family: 'NotoArabic', 'Segoe UI', 'Tahoma', Arial, sans-serif; color: #0f1419; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { width: 100%; }
  .invoice { background: #fff; width: 100%; margin: 0; padding: 40px 48px; }

  /* Header */
  .header { display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: flex-start; padding-bottom: 18px; border-bottom: 1.5px solid #e4e4e7; margin-bottom: 22px; }
  .header-left { text-align: right; }
  .header-left h1 { font-size: 23px; font-weight: 800; letter-spacing: 1px; }
  .header-left p { font-size: 11px; color: #71717a; margin-top: 4px; }
  .header-right { text-align: right; display: flex; flex-direction: column; align-items: stretch; }
  /* Logo on the same line as INVOICE; flush to the right edge so the last "t"
     of "trendlet" sits the same distance from the right margin as the "I" of
     INVOICE from the left. direction:ltr makes flex-end = the true right edge. */
  .header-right .logo-row { display: flex; direction: ltr; align-items: center; justify-content: flex-end; margin-bottom: 14px; }
  /* Company info grouped in a subtle right-aligned card beneath the logo. */
  .company-card { background: #fafafa; border: 1px solid #efeff1; border-radius: 10px; padding: 12px 16px; text-align: right; }
  .company-card p { font-size: 10.5px; color: #6b7280; line-height: 1.7; }
  .company-card .company-name { font-size: 12px; font-weight: 700; color: #0f1419; margin-bottom: 2px; }
  .company-card .company-meta { color: #9ca3af; }

  /* Info grid */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 22px; }
  .info-box { border: 1px solid #ececee; border-radius: 10px; padding: 14px 18px; }
  .info-box h3 { font-size: 12px; color: #c9a84c; font-weight: 700; margin-bottom: 10px; padding-bottom: 7px; border-bottom: 1px solid #f1f1f3; text-align: right; }
  .info-row { display: flex; flex-direction: row; justify-content: space-between; margin-bottom: 8px; }
  .info-row:last-child { margin-bottom: 0; }
  .info-label { font-size: 12px; color: #71717a; text-align: right; }
  .info-value { font-size: 13px; font-weight: 700; text-align: left; }
  /* Numbers/phones must read LTR so a leading + or digits aren't flipped by RTL. */
  .ltr-value { direction: ltr; unicode-bidi: embed; }

  /* Line items table */
  table { width: 100%; border-collapse: collapse; }
  /* On a 2nd page the dark header repeats; rows never split across a page. */
  thead { display: table-header-group; }
  thead tr { background: #0f1419; color: #fff; }
  thead th { padding: 11px 16px; font-size: 13px; font-weight: 600; text-align: center; }
  /* # is now the first (right-most in RTL) column; product is right-aligned via its class */
  thead th:first-child { text-align: center; width: 40px; }
  thead th.th-product { text-align: right; }
  tbody tr { border-bottom: 1px solid #ececed; page-break-inside: avoid; }
  tbody td { padding: 12px 16px; font-size: 14px; vertical-align: middle; text-align: center; }
  tbody td.col-product { text-align: right; }
  tbody td:first-child { width: 40px; color: #a1a1aa; }
  .product-name { font-weight: 700; margin-bottom: 4px; font-size: 14px; }
  .product-sub { font-size: 12px; color: #71717a; }

  /* Totals — compact block aligned to the right half (matches sample) */
  .totals-section { margin-top: 18px; width: 58%; margin-left: auto; }
  .totals-row-line { display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: center; padding: 7px 4px; font-size: 14px; }
  .totals-row-line .t-label { color: #52525b; }
  .totals-row-line .t-value { font-weight: 700; font-size: 15px; }
  .totals-grand-box { background: #0f1419; color: #fff; border-radius: 8px; padding: 16px 20px; display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: center; margin-top: 10px; }
  .totals-grand-box .g-label { font-size: 15px; font-weight: 700; }
  .totals-grand-box .g-value { font-size: 21px; font-weight: 800; color: #c9a84c; }
  /* VAT line below the grand total (to be remitted) */
  .vat-below { display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: center; padding: 9px 4px; margin-top: 4px; font-size: 13px; }
  .vat-below .t-label { color: #71717a; }
  .vat-below .t-value { font-weight: 700; font-size: 14px; color: #0f1419; }
  .sar { font-family: Arial; }

  /* Payment status (flipped) — soft-green "paid" badge on the right; info
     (heading + text) on the left. */
  .payment-status { display: flex; align-items: center; justify-content: space-between; margin-top: 20px; }
  .payment-status.flipped .pay-info { text-align: left; }
  .payment-status.flipped .pay-heading { padding-right: 0; padding-left: 12px; border-right: none; border-left: 3px solid #c9a84c; }
  .payment-status.flipped p { padding-right: 0; padding-left: 12px; }
  .pay-heading { font-size: 12px; font-weight: 700; color: #0f1419; padding-right: 12px; border-right: 3px solid #c9a84c; white-space: nowrap; margin-bottom: 8px; }
  .payment-status p { font-size: 12px; color: #71717a; padding-right: 12px; }
  .paid-pill { background: #ecfdf3; color: #16a34a; font-size: 12px; font-weight: 700; padding: 9px 22px; border-radius: 24px; white-space: nowrap; }

  /* Notes */
  .notes { margin-top: 18px; padding-top: 14px; border-top: 1px dashed #d4d4d8; page-break-inside: avoid; }
  .notes h3 { font-size: 12px; color: #0f1419; font-weight: 700; margin-bottom: 9px; }
  .notes ul { padding-right: 16px; }
  .notes li { font-size: 10.5px; color: #52525b; margin-bottom: 5px; line-height: 1.6; }

  /* Footer */
  .footer { margin-top: 20px; padding-top: 14px; border-top: 1px solid #e4e4e7; display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: center; }
  .footer p { font-size: 11px; color: #a1a1aa; }
  .footer .brand { font-weight: 700; color: #0f1419; }
</style>
</head>
<body>
  <div class="invoice">

    <div class="header">
      <div class="header-left">
        <h1>INVOICE</h1>
        <p>فاتورة ضريبية مبسطة</p>
      </div>
      <div class="header-right">
        <div class="logo-row">${logoHtml}</div>
        <div class="company-card">
          <p class="company-name">متجر محمد سليم المطيري لتقنية المعلومات</p>
          <p>الرياض، المملكة العربية السعودية</p>
          <p><span class="company-meta">سجل تجاري</span> 1010454393 &nbsp;·&nbsp; <span class="company-meta">الرقم الضريبي</span> 310219254700003</p>
        </div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <h3>بيانات العميل</h3>
        <div class="info-row"><span class="info-label">الاسم</span><span class="info-value">${esc(customer.name) || "—"}</span></div>
        <div class="info-row"><span class="info-label">الجوال</span><span class="info-value ltr-value">${esc(customer.phone) || "—"}</span></div>
        <div class="info-row"><span class="info-label">المدينة</span><span class="info-value">${esc(customer.city) || "—"}</span></div>
        <div class="info-row"><span class="info-label">طريقة الدفع</span><span class="info-value">${esc(customer.payment_method) || "—"}</span></div>
      </div>
      <div class="info-box">
        <h3>تفاصيل الفاتورة</h3>
        <div class="info-row"><span class="info-label">رقم الفاتورة</span><span class="info-value">${esc(invoice_number)}</span></div>
        <div class="info-row"><span class="info-label">تاريخ الإصدار</span><span class="info-value">${fmtDate(issue_date)}</span></div>
        <div class="info-row"><span class="info-label">تاريخ الاستحقاق</span><span class="info-value">${fmtDate(due_date)}</span></div>
        ${orderRow}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th class="th-product">المنتج</th>
          <th>الكمية</th>
          <th>السعر</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals-section">
      <div class="totals-row-line">
        <span class="t-value"><span class="sar">ر.س</span> ${money(totals.subtotal)}</span>
        <span class="t-label">المجموع (شامل الضريبة والرسوم)</span>
      </div>
      ${discountRow}
      ${breakdownRows}
      <div class="totals-grand-box">
        <span class="g-value"><span class="sar">ر.س</span> ${money(totals.grand_total)}</span>
        <span class="g-label">الإجمالي المستحق</span>
      </div>
      ${vatRow}
    </div>

    ${paymentSection}

    <div class="notes">
      <h3>ملاحظات</h3>
      <ul>${notesHtml}</ul>
    </div>

    <div class="footer">
      <p>0551215062 · info@trendlet.com · trendlet.com</p>
      <p>شكراً لتعاملكم مع <span class="brand">Trendlet</span> ✦</p>
    </div>

  </div>
</body>
</html>`;
}
