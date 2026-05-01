"use client";

import { useFormState } from "react-dom";
import { X } from "lucide-react";
import { unassignBrandAction, type BrandActionState } from "./actions";
import type { AssignmentByEmployee } from "@/lib/queries/brands";

const initialState: BrandActionState = { ok: false, error: null };

export function AssignmentsByEmployee({
  rows,
}: {
  rows: AssignmentByEmployee[];
}) {
  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-h2 text-ink-primary">Assignments by employee</h2>
        <span className="text-[12px] text-ink-tertiary">
          Brands each employee is primary on. Click × to unassign, or Edit to
          jump to the brand row.
        </span>
      </header>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[1.4fr_0.5fr_2.1fr] items-center gap-3 px-3 text-[10px] font-medium uppercase tracking-[0.4px] text-ink-tertiary">
          <span>Employee</span>
          <span>Region</span>
          <span>Brands</span>
        </div>

        {rows.map((row) => (
          <div
            key={row.user_id}
            className="grid grid-cols-[1.4fr_0.5fr_2.1fr] items-center gap-3 rounded-md border border-hairline bg-surface p-3"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-medium text-ink-primary">
                {row.full_name}
              </span>
              <span className="text-[11px] text-ink-tertiary">
                {row.email}
                {row.roles.length > 0 && ` · ${row.roles.join(", ")}`}
              </span>
            </div>

            <span className="text-[12px] text-ink-secondary">
              {row.region ?? "—"}
            </span>

            {row.brands.length === 0 ? (
              <span className="text-[12px] italic text-ink-tertiary">
                No brands assigned
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {row.brands.map((b) => (
                  <BrandChip
                    key={b.brand_id}
                    brandId={b.brand_id}
                    name={b.name}
                    region={b.region}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function BrandChip({
  brandId,
  name,
  region,
}: {
  brandId: string;
  name: string;
  region: "US" | "EU" | "KSA" | "GLOBAL" | null;
}) {
  const [, dispatch] = useFormState(unassignBrandAction, initialState);

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-neutral-50 py-0.5 pl-2 pr-1 text-[11px] text-ink-primary">
      <a
        href={`#brand-row-${brandId}`}
        className="hover:underline"
        title="Edit this brand"
      >
        {name}
        {region && (
          <span className="ml-1 text-[10px] uppercase tracking-wide text-ink-tertiary">
            {region}
          </span>
        )}
      </a>
      <form action={dispatch} className="flex">
        <input type="hidden" name="brand_id" value={brandId} />
        <button
          type="submit"
          aria-label={`Unassign ${name}`}
          title={`Unassign ${name}`}
          className="rounded-full p-0.5 text-ink-tertiary hover:bg-neutral-200 hover:text-ink-primary"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      </form>
    </span>
  );
}
