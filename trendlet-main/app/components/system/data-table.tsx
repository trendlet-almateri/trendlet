import Link from "next/link";
import { cn } from "@/lib/utils";

export type Column<Row> = {
  key: string;
  header: string;
  /** Where to align cell + header. Defaults to "left". */
  align?: "left" | "right" | "center";
  /** Width hint, e.g. "w-32" or "w-[120px]". */
  width?: string;
  /** Render fn — return any ReactNode. */
  cell: (row: Row) => React.ReactNode;
};

/**
 * Generic table primitive matching the Orders/Dashboard screenshots:
 * header row in muted uppercase, hairline rows, hover row tint,
 * optional checkbox column, optional clickable rows.
 *
 * Whole-row clickability follows the project rule: if `rowHref` is
 * provided, the row navigates on click. Cell-only links would be a
 * UX bug (per memory: feedback_clickable_rows).
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  selectable = false,
  rowHref,
  empty,
  className,
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  selectable?: boolean;
  rowHref?: (row: Row) => string;
  empty?: React.ReactNode;
  className?: string;
}) {
  if (rows.length === 0 && empty) {
    return <div>{empty}</div>;
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-hairline bg-surface shadow-sm",
        className,
      )}
    >
      <table className="w-full table-auto border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-hairline">
            {selectable && (
              <th
                scope="col"
                className="w-[44px] px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.6px] text-ink-tertiary"
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-hairline-strong text-accent focus:ring-1 focus:ring-accent/40"
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.6px] text-ink-tertiary",
                  col.width,
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.align !== "right" && col.align !== "center" && "text-left",
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = rowHref?.(row);
            const cells = (
              <>
                {selectable && (
                  <td className="w-[44px] px-4 py-3 align-middle">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-hairline-strong text-accent focus:ring-1 focus:ring-accent/40"
                      aria-label="Select row"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-3 align-middle text-ink-primary",
                      col.width,
                      col.align === "right" && "text-right tabular-nums",
                      col.align === "center" && "text-center",
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </>
            );

            if (href) {
              return (
                <tr
                  key={rowKey(row)}
                  className="cursor-pointer border-b border-hairline last:border-0 transition-colors hover:bg-hover"
                >
                  {selectable && (
                    <td className="w-[44px] px-4 py-3 align-middle">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-hairline-strong text-accent focus:ring-1 focus:ring-accent/40"
                        aria-label="Select row"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "p-0 align-middle text-ink-primary",
                        col.width,
                      )}
                    >
                      <Link
                        href={href}
                        className={cn(
                          "block px-4 py-3",
                          col.align === "right" && "text-right tabular-nums",
                          col.align === "center" && "text-center",
                        )}
                      >
                        {col.cell(row)}
                      </Link>
                    </td>
                  ))}
                </tr>
              );
            }

            return (
              <tr
                key={rowKey(row)}
                className="border-b border-hairline last:border-0 transition-colors hover:bg-hover"
              >
                {cells}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
