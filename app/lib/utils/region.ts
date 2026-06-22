/**
 * Region buckets used by the Orders UI. Derived from the customer's shipping
 * country so the same bucket is shown in the row pill and the filter dropdown.
 */
export type Region = "KSA" | "US" | "EU" | "Other";

export const REGION_OPTIONS: readonly Region[] = ["KSA", "US", "EU", "Other"] as const;

const EU_CODES = new Set([
  "GB", "DE", "FR", "IT", "ES", "NL", "BE", "AT", "PT", "SE", "DK",
  "FI", "NO", "PL", "CZ", "HU", "RO", "GR", "IE", "HR", "CH", "AE",
]);

/** Map a country string (ISO-2 / ISO-3 / full name) to a region bucket. */
export function regionFromCountry(country?: string | null): Region {
  if (!country) return "Other";
  const c = country.toUpperCase();
  if (["SA", "SAU", "SAUDI ARABIA"].includes(c)) return "KSA";
  if (["US", "USA", "UNITED STATES"].includes(c)) return "US";
  if (EU_CODES.has(c)) return "EU";
  return "Other";
}

/**
 * Backward-compatible label used by the row badge: returns the bucket name,
 * or the raw 3-letter code for unknown countries (matches the pre-existing
 * `regionLabel()` behaviour in order-row.tsx so the badge palette still works).
 */
export function regionLabel(country?: string | null): string | null {
  if (!country) return null;
  const c = country.toUpperCase();
  if (["SA", "SAU", "SAUDI ARABIA"].includes(c)) return "KSA";
  if (["US", "USA", "UNITED STATES"].includes(c)) return "US";
  if (EU_CODES.has(c)) return "EU";
  return country.slice(0, 3).toUpperCase();
}
