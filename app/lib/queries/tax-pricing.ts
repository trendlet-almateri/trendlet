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
 * Resolve an app brand name (brands.name) to the brand name(s) used in
 * pricing_rules, via brand_pricing_aliases. The pricing table splits some
 * brands into Boutique vs Outlet, and uses different spellings (MK Boutique
 * for "Micheal Kors"), so an app brand can resolve to MULTIPLE pricing brands.
 *
 * Falls back to the brand name itself when no alias row exists (covers brands
 * whose name already matches, e.g. DKNY).
 */
export async function resolvePricingBrands(appBrand: string | null): Promise<string[]> {
  if (!appBrand?.trim()) return [];
  const brand = appBrand.trim();
  const sb = createServiceClient() as AnyClient;
  const { data, error } = await sb
    .from("brand_pricing_aliases")
    .select("pricing_brand_name")
    .ilike("app_brand_name", brand);
  if (error) {
    console.error("[resolvePricingBrands]", error);
    return [brand];
  }
  const names = ((data ?? []) as { pricing_brand_name: string }[]).map(
    (r) => r.pricing_brand_name,
  );
  // No alias configured → assume the app name matches a pricing brand directly.
  return names.length ? names : [brand];
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
 * Auto-match a pricing rule for a sub-order by brand + category.
 *
 * Gender is ignored per product decision. Category matches either category_ar
 * or the shopify_product_type_alias bridge column. Case-insensitive, trimmed.
 *
 * The app brand is resolved to its pricing brand(s) via brand_pricing_aliases
 * first. When the brand resolves to a single pricing variant AND the category
 * matches, we return that rule. If it resolves to multiple variants
 * (Boutique/Outlet) we return null so the UI prompts the admin to choose —
 * the price list varies per order and can't be auto-decided.
 *
 * Returns null when nothing matches. The UI falls back to a manual picker.
 */
export async function findPricingRule(
  brandName: string | null,
  productType: string | null,
): Promise<PricingRule | null> {
  if (!brandName || !productType) return null;
  const cat = productType.trim();

  const pricingBrands = await resolvePricingBrands(brandName);
  // Ambiguous (Boutique vs Outlet) — let the admin pick rather than guess.
  if (pricingBrands.length !== 1) return null;

  const sb = createServiceClient() as AnyClient;
  const { data, error } = await sb
    .from("pricing_rules")
    .select(SELECT)
    .ilike("brand_name", pricingBrands[0])
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
