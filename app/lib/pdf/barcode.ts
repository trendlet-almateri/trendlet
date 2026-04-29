import bwipjs from "bwip-js/node";

/**
 * Render a Code128 barcode to a PNG buffer for embedding in a PDF.
 *
 * Phase 2 contract: every customer invoice PDF gets at most one barcode
 * (sourced from `supplier_invoices.barcode`). When the supplier didn't
 * print a barcode on their receipt, the field is null and we don't call
 * this function at all — the PDF just omits the barcode block.
 */
export async function generateBarcodePng(value: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: "code128",
    text: value,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: "center",
    textsize: 8,
  });
}
