/**
 * TableColGroup — the one place table column proportions are defined.
 *
 * Every data table renders a `<TableColGroup>` right after its `<table>` (which
 * must be `table-fixed`). Columns are sized by a shared, semantic scale
 * (xs…xl) rather than by content length, so the same size means the same
 * relative width on every table and the whole app shares one visual rhythm.
 *
 * Widths are percentages, and `table-fixed` renormalizes them to fill the
 * table — they don't have to sum to exactly 100. A column marked `mdOnly`
 * collapses to zero width below the `md` breakpoint; pair it with
 * `hidden md:table-cell` on the matching header/body cells so the column
 * disappears cleanly on tablet/mobile and the remaining columns refill.
 *
 *   <table className="w-full table-fixed …">
 *     <TableColGroup cols={[{ size: "sm" }, { size: "lg" }, … ]} />
 *     <thead>…</thead>
 *
 * Recommended hierarchy: identifiers/counts = xs–sm, secondary text/metrics =
 * md, the primary entity column (customer, product, employee) = lg–xl.
 */

export type ColSize = "xs" | "sm" | "md" | "lg" | "xl";

// Literal class strings (both variants) so Tailwind's JIT can see them.
const W: Record<ColSize, string> = {
  xs: "w-[8%]",
  sm: "w-[11%]",
  md: "w-[16%]",
  lg: "w-[24%]",
  xl: "w-[30%]",
};

const W_MD_ONLY: Record<ColSize, string> = {
  xs: "w-0 md:w-[8%]",
  sm: "w-0 md:w-[11%]",
  md: "w-0 md:w-[16%]",
  lg: "w-0 md:w-[24%]",
  xl: "w-0 md:w-[30%]",
};

export type ColSpec = {
  size: ColSize;
  /** Column is hidden below `md` — collapse its width to 0 there. */
  mdOnly?: boolean;
};

export function TableColGroup({ cols }: { cols: ColSpec[] }) {
  return (
    <colgroup>
      {cols.map((c, i) => (
        <col key={i} className={c.mdOnly ? W_MD_ONLY[c.size] : W[c.size]} />
      ))}
    </colgroup>
  );
}
