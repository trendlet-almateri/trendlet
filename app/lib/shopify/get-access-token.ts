/**
 * Shopify Admin API access token — client credentials grant.
 *
 * This store's app is a Dev Dashboard app whose Admin API tokens expire every
 * 24 hours (expires_in: 86399). There is NO refresh token — you re-request.
 * We mint a token from SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET, cache it in
 * module memory until ~60s before expiry, then re-mint automatically. No manual
 * rotation, no static token.
 *
 *   POST https://{shop}.myshopify.com/admin/oauth/access_token
 *     grant_type=client_credentials
 *     client_id={SHOPIFY_CLIENT_ID}
 *     client_secret={SHOPIFY_CLIENT_SECRET}
 *   → { access_token, expires_in }
 *
 * Docs: https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens
 *
 * Back-compat: if client credentials aren't configured, falls back to a static
 * SHOPIFY_ACCESS_TOKEN (legacy Custom App). Throws if neither is available.
 */

let cachedToken: string | null = null;
let expiresAtMs = 0;

/** "trendlet" or "trendlet.myshopify.com" → "trendlet.myshopify.com". */
function normalizeShopDomain(shop: string): string {
  const s = shop.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return s.endsWith(".myshopify.com") ? s : `${s}.myshopify.com`;
}

/** Full myshopify domain from env. Throws if unset. */
export function getShopDomain(): string {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  if (!shop) throw new Error("SHOPIFY_SHOP_DOMAIN must be set");
  return normalizeShopDomain(shop);
}

/**
 * Returns a valid Admin API access token, minting + caching as needed.
 * Always call this right before a Shopify Admin API request.
 */
export async function getShopifyAccessToken(): Promise<string> {
  // Shopify labels these "API key" / "API secret key"; the OAuth grant calls
  // them client_id / client_secret — same values. Read whichever name is set.
  const clientId = process.env.SHOPIFY_API_KEY ?? process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_API_SECRET ?? process.env.SHOPIFY_CLIENT_SECRET;

  // Legacy fallback: static token (Custom App) when client creds not configured.
  if (!clientId || !clientSecret) {
    const staticToken = process.env.SHOPIFY_ACCESS_TOKEN;
    if (staticToken) return staticToken;
    throw new Error(
      "Shopify auth not configured: set SHOPIFY_API_KEY + SHOPIFY_API_SECRET (client credentials grant), or a legacy SHOPIFY_ACCESS_TOKEN",
    );
  }

  // Reuse the cached token until 60s before it expires.
  if (cachedToken && Date.now() < expiresAtMs - 60_000) return cachedToken;

  const domain = getShopDomain();
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Shopify client_credentials token request failed (${res.status}): ${body.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error("Shopify token response missing access_token");
  }

  cachedToken = data.access_token;
  expiresAtMs = Date.now() + (data.expires_in ?? 86399) * 1000;
  return cachedToken;
}
