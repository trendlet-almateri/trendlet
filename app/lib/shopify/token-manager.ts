/**
 * Shopify offline token manager.
 *
 * Stores expiring offline tokens in shopify_tokens (one row per shop) and
 * auto-refreshes them when they're about to expire. Every Shopify API
 * call should go through getValidToken(shop) — it returns a guaranteed-
 * fresh access_token.
 *
 * Refresh tokens are one-time use per Shopify's spec: every refresh call
 * returns BOTH a new access_token AND a new refresh_token. We must
 * overwrite both immediately or we lose access.
 *
 * If the refresh_token itself expires (90 days from last issuance), the
 * merchant has to re-launch the app to get a new pair — at which point
 * /api/shopify/bootstrap can be re-run.
 */
import { createServiceClient } from "@/lib/supabase/server";

/** How close to expiry we consider a token "expired" and refresh proactively. */
const REFRESH_BUFFER_MS = 10 * 60 * 1000; // 10 minutes

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID ?? "";
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET ?? "";

export type ShopifyTokenRow = {
  id: string;
  shop: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  refresh_token_expires_at: string;
  scope: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ShopifyTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in: number;
  scope?: string;
};

/**
 * Read the current token row for a shop. Returns null if never bootstrapped.
 * Service-role client — bypasses RLS so this works in cron jobs and
 * server actions regardless of the calling user's role.
 */
export async function getTokenFromDB(shop: string): Promise<ShopifyTokenRow | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("shopify_tokens")
    .select("*")
    .eq("shop", shop)
    .maybeSingle();
  if (error) {
    console.error("[shopify-token] read failed", error);
    return null;
  }
  return (data as ShopifyTokenRow | null) ?? null;
}

/**
 * Persist a token response from Shopify into the DB. Used on bootstrap
 * AND on every refresh — same shape, single overwrite path.
 */
export async function persistToken(
  shop: string,
  data: ShopifyTokenResponse,
): Promise<void> {
  const now = Date.now();
  const expiresAt = new Date(now + data.expires_in * 1000).toISOString();
  const refreshTokenExpiresAt = new Date(
    now + data.refresh_token_expires_in * 1000,
  ).toISOString();

  const sb = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from("shopify_tokens") as any).upsert(
    {
      shop,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
      refresh_token_expires_at: refreshTokenExpiresAt,
      scope: data.scope ?? null,
      client_id: SHOPIFY_CLIENT_ID || null,
    },
    { onConflict: "shop" },
  );
  if (error) {
    throw new Error(`Failed to persist Shopify token: ${error.message}`);
  }
}

/**
 * Use the refresh_token to get a new access_token + refresh_token pair.
 * Per Shopify, the previous refresh_token is invalidated after this call —
 * we always overwrite both columns immediately to avoid losing access.
 */
export async function refreshToken(shop: string): Promise<string> {
  if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    throw new Error(
      "SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET must be set in env to refresh tokens.",
    );
  }

  const current = await getTokenFromDB(shop);
  if (!current) {
    throw new Error(
      `No Shopify token row for shop "${shop}". Run /admin/shopify-bootstrap first.`,
    );
  }

  // Refresh token itself expired — admin must re-bootstrap.
  if (new Date(current.refresh_token_expires_at).getTime() < Date.now()) {
    throw new Error(
      `Shopify refresh_token for "${shop}" expired on ${current.refresh_token_expires_at}. Re-run /admin/shopify-bootstrap.`,
    );
  }

  const response = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: current.refresh_token,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Shopify refresh failed (${response.status}): ${body.slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as ShopifyTokenResponse;
  await persistToken(shop, data);
  return data.access_token;
}

/**
 * Return a valid access_token for the given shop, refreshing if it's
 * within REFRESH_BUFFER_MS of expiring. Always call this RIGHT BEFORE
 * making a Shopify API request — never cache the returned string.
 */
export async function getValidToken(shop: string): Promise<string> {
  const current = await getTokenFromDB(shop);
  if (!current) {
    throw new Error(
      `No Shopify token for "${shop}". Bootstrap via /admin/shopify-bootstrap.`,
    );
  }

  const expiresAtMs = new Date(current.expires_at).getTime();
  const expiresSoon = expiresAtMs < Date.now() + REFRESH_BUFFER_MS;

  if (expiresSoon) {
    return refreshToken(shop);
  }
  return current.access_token;
}

/**
 * Default Shopify shop domain (single-store deployment). Override per-call
 * when going multi-store.
 */
export function getDefaultShopDomain(): string {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  if (!shop) {
    throw new Error(
      "SHOPIFY_SHOP_DOMAIN must be set in env (e.g. trendlet.myshopify.com).",
    );
  }
  return shop;
}
