/**
 * Render the customer-facing simplified tax invoice (فاتورة ضريبية مبسطة) to a
 * PDF Buffer using headless Chrome.
 *
 * We render from HTML (not react-pdf) because the invoice mixes Arabic + Latin
 * on the same line (e.g. "حقيبة يد جلدية – Stella McCartney"), which react-pdf's
 * textkit cannot reorder without crashing. The browser's bidi engine handles it
 * natively.
 *
 * Environment:
 *  - Vercel/serverless: @sparticuz/chromium provides the chromium binary.
 *  - Local dev: falls back to a system Chrome/Edge install (set
 *    PUPPETEER_EXECUTABLE_PATH to override).
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { renderTaxInvoiceHtml } from "./tax-invoice-html";
import type { TaxInvoicePdfData } from "./tax-invoice-types";

export type { TaxInvoicePdfData, TaxInvoiceLineItem } from "./tax-invoice-types";

/* ── logo (embedded as data URL so the PDF is self-contained) ────────── */

let cachedLogoDataUrl: string | null | undefined;
async function loadLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  const candidates = [
    join(process.cwd(), "public", "logo.png"),
    join(process.cwd(), "app", "public", "logo.png"),
    "/var/task/public/logo.png",
  ];
  for (const p of candidates) {
    try {
      const bytes = await readFile(p);
      cachedLogoDataUrl = `data:image/png;base64,${bytes.toString("base64")}`;
      return cachedLogoDataUrl;
    } catch {
      // try next
    }
  }
  console.warn("[tax-invoice-pdf] logo.png not found; using SVG wordmark fallback");
  cachedLogoDataUrl = null;
  return null;
}

/* ── browser launch (serverless vs local) ────────────────────────────── */

// Common local Chrome/Edge locations (Windows + macOS + Linux).
const LOCAL_CHROME_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
].filter(Boolean) as string[];

async function firstExisting(paths: string[]): Promise<string | null> {
  const { access } = await import("node:fs/promises");
  for (const p of paths) {
    try {
      await access(p);
      return p;
    } catch {
      // next
    }
  }
  return null;
}

/**
 * Whether we're in a serverless/Lambda-style runtime where the bundled
 * @sparticuz/chromium must be used instead of a local browser.
 */
function isServerless(): boolean {
  return !!process.env.AWS_LAMBDA_FUNCTION_VERSION || !!process.env.VERCEL;
}

/* ── public renderer ─────────────────────────────────────────────────── */

export async function renderTaxInvoicePdf(data: TaxInvoicePdfData): Promise<Buffer> {
  const logoDataUrl = await loadLogoDataUrl();
  const html = renderTaxInvoiceHtml(data, logoDataUrl);

  // puppeteer-core is the same in both environments; only the launch args differ.
  const puppeteer = (await import("puppeteer-core")).default;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any;
  if (isServerless()) {
    const chromium = (await import("@sparticuz/chromium")).default;
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } else {
    const executablePath = await firstExisting(LOCAL_CHROME_PATHS);
    if (!executablePath) {
      throw new Error(
        "No local Chrome/Edge found for PDF rendering. Set PUPPETEER_EXECUTABLE_PATH.",
      );
    }
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    // Long (many-item) orders flow naturally onto a 2nd page. The notes block
    // uses `page-break-inside: avoid` so it never splits awkwardly across pages.
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
