/**
 * Pricing rule lookup for sub-order fee calculation.
 *
 * Match key: brand_name + category_ar (= sub_orders.product_type)
 * Fallback:  shopify_product_type_alias when product_type ≠ category_ar exactly
 * Gender:    preferred when supplied, but gracefully ignored if not available
 *
 * Usage:
 *   const rule = await lookupPricingRule("Louis Vuitton", "شنط كتف");
 *   // rule.total_fee === 450, rule.service_fee_with_vat === 100, rule.shipping_customs_fee === 350
 */

import { createServiceClient } from "@/lib/supabase/server";

export type PricingRule = {
  id: string;
  brand_name: string;
  category_ar: string;
  gender: string | null;
  service_fee_with_vat: number;
  service_fee_net: number;
  service_fee_vat: number;
  shipping_customs_fee: number;
  total_fee: number;
  shopify_product_type_alias: string | null;
};

/**
 * Look up the pricing rule for a given brand + product_type combination.
 *
 * @param brandName   - sub_orders.brand_name_raw  (e.g. "Louis Vuitton")
 * @param productType - sub_orders.product_type    (e.g. "شنط كتف")
 * @param gender      - optional gender preference ("نسائي" | "رجالي" | "أطفال")
 * @returns Matching PricingRule or null if no match found
 */
export async function lookupPricingRule(
  brandName: string,
  productType: string | null | undefined,
  gender?: string | null,
): Promise<PricingRule | null> {
  if (!brandName || !productType) return null;

  const sb = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).from("pricing_rules")
    .select(
      "id,brand_name,category_ar,gender,service_fee_with_vat,service_fee_net,service_fee_vat,shipping_customs_fee,total_fee,shopify_product_type_alias",
    )
    .eq("brand_name", brandName)
    .or(`category_ar.eq.${productType},shopify_product_type_alias.eq.${productType}`)
    .order("gender", { ascending: false, nullsFirst: false }) // prefer rows with a gender
    .limit(10); // fetch up to 10 then pick best match in JS

  if (error || !data || data.length === 0) return null;

  const rows = data as PricingRule[];

  // Prefer gender match if supplied, otherwise take first result
  if (gender) {
    const genderMatch = rows.find((r) => r.gender === gender);
    if (genderMatch) return genderMatch;
  }

  return rows[0] ?? null;
}

/**
 * Batch-lookup pricing rules for multiple sub-orders.
 * More efficient than calling lookupPricingRule per item.
 *
 * @param items - array of { brandName, productType, gender? }
 * @returns Map keyed by `${brandName}::${productType}` → PricingRule | null
 */
export async function batchLookupPricingRules(
  items: Array<{ brandName: string; productType: string | null | undefined; gender?: string | null }>,
): Promise<Map<string, PricingRule | null>> {
  const result = new Map<string, PricingRule | null>();
  if (items.length === 0) return result;

  const uniqueBrands = [...new Set(items.map((i) => i.brandName).filter(Boolean))];
  const uniqueTypes  = [...new Set(items.map((i) => i.productType).filter(Boolean))] as string[];

  if (uniqueBrands.length === 0 || uniqueTypes.length === 0) return result;

  const sb = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).from("pricing_rules")
    .select(
      "id,brand_name,category_ar,gender,service_fee_with_vat,service_fee_net,service_fee_vat,shipping_customs_fee,total_fee,shopify_product_type_alias",
    )
    .in("brand_name", uniqueBrands);

  if (error || !data) return result;

  const rows = data as PricingRule[];

  for (const item of items) {
    const key = `${item.brandName}::${item.productType}`;
    if (result.has(key)) continue;

    const candidates = rows.filter(
      (r) =>
        r.brand_name === item.brandName &&
        (r.category_ar === item.productType || r.shopify_product_type_alias === item.productType),
    );

    if (candidates.length === 0) {
      result.set(key, null);
      continue;
    }

    const match =
      (item.gender ? candidates.find((r) => r.gender === item.gender) : null)
      ?? candidates[0];

    result.set(key, match ?? null);
  }

  return result;
}
