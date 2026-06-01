/**
 * Fetch a product's product_type from the Shopify Admin API.
 *
 * product_type is not present on order webhook payloads (orders only carry
 * line-item title/vendor/sku), so order ingestion calls this per line item to
 * populate sub_orders.product_type.
 *
 * Fail-safe by design: returns null on any error (missing creds, network,
 * non-2xx, missing product) so it never blocks order ingestion.
 */
const SHOPIFY_API_VERSION = "2024-10";

export async function fetchProductType(
  productId: string | number | null | undefined,
): Promise<string | null> {
  if (!productId) return null;

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!shopDomain || !accessToken) return null;

  try {
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
