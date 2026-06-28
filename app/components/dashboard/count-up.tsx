"use client";

import * as React from "react";
import { formatCurrency } from "@/lib/utils/currency";

/**
 * CountUp — animates a number from 0 to `value` on mount, then renders the
 * final formatted string. Used for KPI metrics so they feel "alive" without
 * making the whole card a client component (only this number is client).
 *
 * Formatting is driven by serializable props (not a function), so this can be
 * rendered directly from a Server Component. Pass `currency` to format as
 * money; otherwise it renders a grouped integer.
 *
 * Honours prefers-reduced-motion: renders the final value immediately, no tween.
 */
export function CountUp({
  value,
  currency,
  compact = false,
  durationMs = 900,
}: {
  value: number;
  /** When set, format the value as currency instead of a plain integer. */
  currency?: string;
  compact?: boolean;
  durationMs?: number;
}) {
  const format = React.useCallback(
    (n: number) =>
      currency
        ? formatCurrency(n, currency, { compact })
        : Math.round(n).toLocaleString("en-US"),
    [currency, compact],
  );

  const [display, setDisplay] = React.useState(value);

  React.useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value === 0) {
      setDisplay(value);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — fast then settles
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <>{format(display)}</>;
}
