/**
 * Fetch a product's product_type from the Shopify Admin API.
 *
 * product_type is not present on order webhook payloads (orders only carry
 * line-item title/vendor/sku), so order ingestion calls this per line item to
 * populate sub_orders.product_type.
 *
 * Reads the non-expiring Custom App token from env (SHOPIFY_ACCESS_TOKEN).
 * Token-exchange auto-refresh (getValidToken) does NOT work for Custom App
 * tokens — Shopify returns invalid_subject_token — so we use the env token
 * directly. Fail-safe: returns null on any error so it never blocks ingestion.
 */
import { getShopifyAccessToken, getShopDomain } from "@/lib/shopify/get-access-token";

const SHOPIFY_API_VERSION = "2024-10";

export async function fetchProductType(
  productId: string | number | null | undefined,
): Promise<string | null> {
  if (!productId) return null;

  try {
    const shopDomain = getShopDomain();
    const accessToken = await getShopifyAccessToken();
    const res = await fetch(
      `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/products/${productId}.json?fields=product_type`,
      {
        headers: { "X-Shopify-Access-Token": accessToken, Accept: "application/json" },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { product?: { product_type?: string | null } };
    const pt = data.product?.product_type;
    return pt && pt.trim() !== "" ? pt : null;
  } catch {
    return null;
  }
}
