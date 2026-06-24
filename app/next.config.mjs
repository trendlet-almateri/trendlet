/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
    // Keep the PDF renderer's native deps out of the server bundle. Without
    // this, Next relocates @sparticuz/chromium and its bin/ vanishes at runtime
    // ("input directory .../@sparticuz/chromium/bin does not exist").
    // Next 14 key (top-level serverExternalPackages is Next 15).
    serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
    // Force-bundle public assets read at runtime (e.g. logo.png used by the
    // PDF renderer). Without this, Vercel's tracer doesn't follow runtime
    // fs.readFile calls and the asset is missing in production.
    outputFileTracingIncludes: {
      // The PDF renderer needs the logo/fonts AND the @sparticuz/chromium
      // binary (bin/*.br). External packages aren't auto-traced into every
      // function, so include the chromium files explicitly for each route that
      // renders a PDF — otherwise: "input directory .../chromium/bin not exist".
      "/invoices/**": ["./public/logo.png", "./public/fonts/**", "./node_modules/@sparticuz/chromium/**"],
      "/tax-invoices/**": ["./public/logo.png", "./public/fonts/**", "./node_modules/@sparticuz/chromium/**"],
      "/api/**": ["./public/logo.png", "./public/fonts/**", "./node_modules/@sparticuz/chromium/**"],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};
export default nextConfig;
