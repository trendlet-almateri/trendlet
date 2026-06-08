import { createServiceClient } from "@/lib/supabase/server";

// pricing_rules is a dashboard-created table absent from the generated Database
// types, so the typed client rejects its name. Cast to any for these reads —
// the row shapes are validated by toRule() below. Mirrors the existing
// `(sb.from(...) as any)` convention used elsewhere for untyped writes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

/**
 * A row from the pricing_rules table (the brand + Arabic-category fee schedule
 * used to build tax invoices). Created via the Supabase dashboard; see the
 * tax_invoices migration for how these feed an issued invoice.
 */
export type PricingRule = {
  id: string;
  brand_name: string;
  category_ar: string;
  gender: string | null;
  service_fee_net: number;
  service_fee_vat: number;
  service_fee_with_vat: number;
  shipping_customs_fee: number;
  total_fee: number | null;
  shopify_product_type_alias: string | null;
};

const SELECT =
  "id, brand_name, category_ar, gender, service_fee_net, service_fee_vat, service_fee_with_vat, shipping_customs_fee, total_fee, shopify_product_type_alias";

/**
 * Strict 1:1 brand resolution.
 *
 * The Shopify vendor (carried through as brands.name) IS the pricing-table key.
 * Brand variants like "Tory Burch" and "Tory Burch Outlet" are DISTINCT and
 * never interchangeable — each vendor string is a hard identifier. There is NO
 * alias expansion, NO Boutique/Outlet grouping, and NO fuzzy fallback. The
 * pricing lookup matches pricing_rules.brand_name exactly (case-insensitive).
 *
 * (Kept returning string[] for the manual picker callers, but it now always
 * yields exactly the vendor string — never multiple.)
 */
export async function resolvePricingBrands(appBrand: string | null): Promise<string[]> {
  const brand = appBrand?.trim();
  return brand ? [brand] : [];
}

function toRule(r: Record<string, unknown>): PricingRule {
  return {
    id: r.id as string,
    brand_name: r.brand_name as string,
    category_ar: r.category_ar as string,
    gender: (r.gender as string | null) ?? null,
    service_fee_net: Number(r.service_fee_net ?? 0),
    service_fee_vat: Number(r.service_fee_vat ?? 0),
    service_fee_with_vat: Number(r.service_fee_with_vat ?? 0),
    shipping_customs_fee: Number(r.shipping_customs_fee ?? 0),
    total_fee: r.total_fee != null ? Number(r.total_fee) : null,
    shopify_product_type_alias: (r.shopify_product_type_alias as string | null) ?? null,
  };
}

/**
 * Auto-match a pricing rule for a sub-order by brand + category — DETERMINISTIC.
 *
 * Strict 1:1: pricing_rules.brand_name must EXACTLY equal the vendor brand
 * (ILIKE without wildcards = case-insensitive exact match). Brand variants are
 * distinct — "Tory Burch" matches only the "Tory Burch" row, never
 * "Tory Burch Outlet". No alias expansion, no ambiguity blocking, no fuzzy
 * matching. If the exact brand+category exists → return it; otherwise → null
 * (the order lands as needs_pricing for manual entry).
 *
 * Category matches either category_ar or the shopify_product_type_alias bridge
 * column. Gender is ignored. Both comparisons are case-insensitive, trimmed.
 */
export async function findPricingRule(
  brandName: string | null,
  productType: string | null,
): Promise<PricingRule | null> {
  if (!brandName || !productType) return null;
  const brand = brandName.trim();
  const cat = productType.trim();

  const sb = createServiceClient() as AnyClient;
  const { data, error } = await sb
    .from("pricing_rules")
    .select(SELECT)
    .ilike("brand_name", brand) // exact (no % wildcards) → 1:1 vendor match
    .or(`category_ar.ilike.${cat},shopify_product_type_alias.ilike.${cat}`)
    .limit(1);

  if (error) {
    console.error("[findPricingRule]", error);
    return null;
  }
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  return row ? toRule(row) : null;
}

/**
 * Admin view: every app brand (from the brands table) with the pricing-brand
 * name(s) it currently resolves to. A brand with an empty `pricingBrands` array
 * has no alias AND no same-named pricing brand → it will only price via manual
 * entry until an alias is added or its name matches a pricing brand.
 */
export type BrandAliasRow = {
  appBrand: string;
  pricingBrands: string[];
  /** True when the resolution comes from a same-name fallback, not an alias row. */
  viaNameMatch: boolean;
};

export async function fetchBrandAliasMap(): Promise<BrandAliasRow[]> {
  const sb = createServiceClient() as AnyClient;

  const [{ data: brandRows }, { data: aliasRows }, pricingBrands] = await Promise.all([
    sb.from("brands").select("name").order("name"),
    sb.from("brand_pricing_aliases").select("app_brand_name, pricing_brand_name"),
    listPricingBrands(),
  ]);

  const pricingSet = new Set(pricingBrands.map((b) => b.toLowerCase()));
  const aliasesByBrand = new Map<string, string[]>();
  for (const a of (aliasRows ?? []) as { app_brand_name: string; pricing_brand_name: string }[]) {
    const key = a.app_brand_name.toLowerCase();
    const list = aliasesByBrand.get(key) ?? [];
    list.push(a.pricing_brand_name);
    aliasesByBrand.set(key, list);
  }

  return ((brandRows ?? []) as { name: string }[]).map((b) => {
    const aliases = aliasesByBrand.get(b.name.toLowerCase()) ?? [];
    if (aliases.length) return { appBrand: b.name, pricingBrands: aliases, viaNameMatch: false };
    // No alias — does the name itself match a pricing brand?
    if (pricingSet.has(b.name.toLowerCase()))
      return { appBrand: b.name, pricingBrands: [b.name], viaNameMatch: true };
    return { appBrand: b.name, pricingBrands: [], viaNameMatch: false };
  });
}

/** Distinct brand names present in the pricing table (for the manual picker). */
export async function listPricingBrands(): Promise<string[]> {
  const sb = createServiceClient() as AnyClient;
  const { data, error } = await sb
    .from("pricing_rules")
    .select("brand_name")
    .order("brand_name");
  if (error) {
    console.error("[listPricingBrands]", error);
    return [];
  }
  const seen = new Set<string>();
  for (const r of (data ?? []) as { brand_name: string }[]) seen.add(r.brand_name);
  return [...seen];
}

/**
 * Pricing rules for the category select. Accepts the APP brand name, resolves
 * it to its pricing brand(s) via aliases, and returns the union of their rules.
 * Each rule keeps its own brand_name so the UI can label Boutique vs Outlet.
 */
export async function listRulesForBrand(appBrandName: string): Promise<PricingRule[]> {
  if (!appBrandName.trim()) return [];
  const pricingBrands = await resolvePricingBrands(appBrandName);
  if (pricingBrands.length === 0) return [];

  const sb = createServiceClient() as AnyClient;
  const { data, error } = await sb
    .from("pricing_rules")
    .select(SELECT)
    .in("brand_name", pricingBrands)
    .order("brand_name")
    .order("category_ar");
  if (error) {
    console.error("[listRulesForBrand]", error);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map(toRule);
}
