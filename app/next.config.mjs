/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
    // Force-bundle public assets read at runtime (e.g. logo.png used by the
    // PDF renderer). Without this, Vercel's tracer doesn't follow runtime
    // fs.readFile calls and the asset is missing in production.
    outputFileTracingIncludes: {
      "/invoices/**": ["./public/logo.png", "./public/fonts/**"],
      "/api/**": ["./public/logo.png", "./public/fonts/**"],
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
