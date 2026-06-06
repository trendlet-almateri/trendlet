import { requireAdmin } from "@/lib/auth/require-role";
import { fetchBrandAliasMap, listPricingBrands } from "@/lib/queries/tax-pricing";
import { PageHeader } from "@/components/system";
import { BrandAliasRowForm } from "./brand-alias-row-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Brand pricing · Trendslet Operations" };

export default async function AdminBrandPricingPage() {
  await requireAdmin();

  const [rows, pricingBrands] = await Promise.all([
    fetchBrandAliasMap(),
    listPricingBrands(),
  ]);

  const mapped = rows.filter((r) => r.pricingBrands.length > 0).length;
  const unmapped = rows.length - mapped;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Brand pricing"
        subtitle={
          <>
            {rows.length} {rows.length === 1 ? "brand" : "brands"}
            {mapped > 0 && ` · ${mapped} mapped`}
            {unmapped > 0 && ` · ${unmapped} unmapped`}
          </>
        }
      />

      <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--hover)] p-3 text-[11px] text-[var(--muted)]">
        Map each app brand to the brand name(s) used in the pricing table. Pick{" "}
        <strong className="text-ink-secondary">two</strong> when a brand has separate
        Boutique and Outlet price lists — the tax-invoice screen will then ask which one
        applies per order. A brand left unmapped prices only by exact name match or manual
        entry. Add aliases here whenever you add a new brand to the website.
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1.2fr_2fr_auto] items-center gap-3 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        <span>App brand</span>
        <span>Pricing brand(s)</span>
        <span className="justify-self-end">&nbsp;</span>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <BrandAliasRowForm
            key={row.appBrand}
            appBrand={row.appBrand}
            current={row.pricingBrands}
            viaNameMatch={row.viaNameMatch}
            pricingBrands={pricingBrands}
          />
        ))}
      </div>
    </div>
  );
}
