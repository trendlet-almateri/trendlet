export type CurrencyCode = "SAR" | "USD" | "EUR" | "AED" | "GBP";

const SYMBOLS: Record<CurrencyCode, string> = {
  SAR: "SAR",
  USD: "$",
  EUR: "€",
  AED: "AED",
  GBP: "£",
};

/**
 * Format a money value in its native currency. The system never converts
 * between currencies — each currency is displayed standalone (per §1).
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: CurrencyCode | string,
  opts: { compact?: boolean } = {},
): string {
  if (amount == null) return "—";
  const symbol = SYMBOLS[currency as CurrencyCode] ?? currency;
  const formatted = opts.compact
    ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(amount)
    : new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return `${symbol} ${formatted}`;
}
