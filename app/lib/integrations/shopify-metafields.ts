/**
 * Fetch the `custom.extra` metafield for a Shopify product, used by the tax
 * invoice to derive the per-item shipping/profit/VAT breakdown.
 *
 * Uses the app's standard token path (getShopifyAccessToken / getShopDomain),
 * so it works wherever the Shopify credentials are configured (production env).
 * Read-only GET; cached per product id for the lifetime of the process.
 */

import { getShopifyAccessToken, getShopDomain } from "@/lib/shopify/get-access-token";

const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2024-10";

// Process-lifetime cache: one product is usually requested once per render, but
// multi-item orders with the same product won't re-hit Shopify.
const extraCache = new Map<string, number | null>();

/**
 * Returns the numeric `custom.extra` metafield value for a product, or null if
 * the product has no such metafield (or it isn't a number). Never throws on a
 * missing metafield — only logs and returns null on a hard API failure.
 */
export async function getProductExtra(productId: string | number): Promise<number | null> {
  const id = String(productId);
  if (extraCache.has(id)) return extraCache.get(id) ?? null;

  let value: number | null = null;
  try {
    const domain = getShopDomain();
    const token = await getShopifyAccessToken();
    const res = await fetch(
      `https://${domain}/admin/api/${API_VERSION}/products/${id}/metafields.json?namespace=custom&key=extra`,
      { headers: { "X-Shopify-Access-Token": token, Accept: "application/json" } },
    );
    if (res.ok) {
      const data = (await res.json()) as { metafields?: { value?: string }[] };
      const raw = data.metafields?.[0]?.value;
      const n = raw != null ? parseFloat(raw) : NaN;
      value = Number.isFinite(n) ? n : null;
    } else {
      console.warn(`[shopify-metafields] custom.extra fetch ${res.status} for product ${id}`);
    }
  } catch (e) {
    console.error("[shopify-metafields] getProductExtra failed", e);
  }

  extraCache.set(id, value);
  return value;
}

/**
 * Set (create/overwrite) the `custom.extra` metafield on a product. Used by the
 * admin "add extra" flow when a product is missing it. Needs write_products
 * scope. Throws on failure so the caller can surface it.
 */
export async function setProductExtra(productId: string | number, value: number): Promise<void> {
  const id = String(productId);
  const domain = getShopDomain();
  const token = await getShopifyAccessToken();
  const res = await fetch(
    `https://${domain}/admin/api/${API_VERSION}/products/${id}/metafields.json`,
    {
      method: "POST",
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({
        metafield: { namespace: "custom", key: "extra", type: "number_integer", value: String(Math.round(value)) },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Shopify setProductExtra ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  extraCache.set(id, value); // keep the process cache consistent
}
