import { requireAdmin } from "@/lib/auth/require-role";
import {
  fetchBrandsForAdmin,
  fetchAssigneeOptions,
  fetchAssignmentsByEmployee,
  fetchOrphanBrands,
} from "@/lib/queries/brands";
import { PageHeader } from "@/components/system";
import { BrandRowForm } from "./brand-row-form";
import { NewBrandForm } from "./new-brand-form";
import { AssignmentsByEmployee } from "./assignments-by-employee";
import { OrphanBrandsPanel } from "./orphan-brands";

export const dynamic = "force-dynamic";

export const metadata = { title: "Brands · Trendslet Operations" };

export default async function AdminBrandsPage() {
  await requireAdmin();

  const [brands, assignees, assignmentsByEmployee, orphans] = await Promise.all([
    fetchBrandsForAdmin(),
    fetchAssigneeOptions(),
    fetchAssignmentsByEmployee(),
    fetchOrphanBrands(),
  ]);

  const eu = brands.filter((b) => b.region === "EU").length;
  const us = brands.filter((b) => b.region === "US").length;
  const unassigned = brands.filter((b) => !b.primary_assignee).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Brands"
        subtitle={<>
          {brands.length.toLocaleString("en-US")}{" "}
          {brands.length === 1 ? "brand" : "brands"}
          {us > 0 && ` · ${us} US`}
          {eu > 0 && ` · ${eu} EU`}
          {unassigned > 0 && ` · ${unassigned} unassigned`}
        </>}
      />

      <OrphanBrandsPanel orphans={orphans} />

      <NewBrandForm assignees={assignees} />

      {/* Column headers (only when at least one brand exists) */}
      {brands.length > 0 && (
        <div className="grid grid-cols-[1.5fr_0.7fr_0.7fr_1.4fr_auto_auto] items-center gap-3 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          <span>Brand</span>
          <span>Region</span>
          <span className="text-right">Markup</span>
          <span>Primary assignee</span>
          <span className="justify-self-end">&nbsp;</span>
          <span className="justify-self-end">&nbsp;</span>
        </div>
      )}

      {brands.length > 0 && (
        <div className="flex flex-col gap-2">
          {brands.map((b) => (
            <BrandRowForm key={b.id} brand={b} assignees={assignees} />
          ))}
        </div>
      )}

      <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--hover)] p-3 text-[11px] text-[var(--muted)]">
        <strong className="text-ink-secondary">How routing works:</strong>{" "}
        Region <code>EU</code> sends sub-orders to the assigned fulfiller&apos;s queue.
        Region <code>US</code> sends sub-orders to the assigned sourcing employee&apos;s queue,
        then to all warehouse employees once they hit{" "}
        <code>delivered_to_warehouse</code>. Brands without a primary assignee
        land in the <code>/orders/unassigned</code> queue.
      </div>

      <AssignmentsByEmployee rows={assignmentsByEmployee} />
    </div>
  );
}
