/**
 * Fetch a product's product_type from the Shopify Admin API.
 *
 * product_type is not present on order webhook payloads (orders only carry
 * line-item title/vendor/sku), so order ingestion calls this per line item to
 * populate sub_orders.product_type.
 *
 * Uses getValidToken() so the (expiring) access token is auto-refreshed.
 * Fail-safe by design: returns null on any error (no token row, network,
 * non-2xx, missing product) so it never blocks order ingestion.
 */
import { getValidToken, getDefaultShopDomain } from "@/lib/shopify/token-manager";

const SHOPIFY_API_VERSION = "2024-10";

export async function fetchProductType(
  productId: string | number | null | undefined,
): Promise<string | null> {
  if (!productId) return null;

  try {
    const shopDomain = getDefaultShopDomain();
    const accessToken = await getValidToken(shopDomain);

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
