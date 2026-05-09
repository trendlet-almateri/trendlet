/**
 * Generate the Trendslet by Almateri system-overview PDF.
 *
 * Output: ../docs/trendlet-almateri.pdf (relative to app/)
 *
 * Run: npx tsx scripts/generate-overview-pdf.ts
 *
 * Re-run any time the in-repo feature inventory drifts. The template
 * lives in lib/pdf/trendlet-overview-pdf.tsx — keep both in sync.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderTrendletOverviewPdf } from "../lib/pdf/trendlet-overview-pdf";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../../docs/trendlet-almateri.pdf");

async function main() {
  console.log("→ rendering Trendslet overview PDF…");
  const start = Date.now();

  const buf = await renderTrendletOverviewPdf();

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, buf);

  const ms = Date.now() - start;
  const kb = (buf.length / 1024).toFixed(1);
  console.log(`✓ wrote ${OUT} (${kb} KB) in ${ms} ms`);
}

main().catch((err) => {
  console.error("✗ generation failed:", err);
  process.exit(1);
});
