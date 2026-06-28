"use client";

import * as React from "react";

/**
 * CountUp — animates a number from 0 to `value` on mount, then renders the
 * final formatted string. Used for KPI metrics so they feel "alive" without
 * making the whole card a client component (only this number is client).
 *
 * Honours prefers-reduced-motion: renders the final value immediately, no tween.
 */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString("en-US"),
  durationMs = 900,
}: {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
}) {
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
