import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { fetchInvoices, fetchInvoiceCounts } from "@/lib/queries/invoices";
import { PageHeader } from "@/components/system";
import { InvoicesList, InvoicesStats, InvoicesSkeleton } from "./invoices-list";

export const dynamic = "force-dynamic";

export const metadata = { title: "Invoices · Trendslet Operations" };

export default async function InvoicesPage() {
  // Sourcing + EU fulfiller can also access this page — they see only invoices
  // they created (filtered by generated_by). Warehouse stays out per spec.
  const user = await requireRole(["admin", "sourcing", "fulfiller"]);
  const isAdmin = user.roles.includes("admin");
  const scope = isAdmin ? {} : { generatedBy: user.id };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <PageHeader title="Invoices" />
        <Link
          href="/invoices/new"
          className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-[var(--accent)] px-4 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(15,20,25,0.10),0_4px_12px_-4px_rgba(12,68,124,0.35)] transition-all duration-200 hover:-translate-y-px hover:bg-[#0a3a6a] hover:shadow-[0_2px_4px_rgba(15,20,25,0.10),0_8px_18px_-6px_rgba(12,68,124,0.40)] active:translate-y-0"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New Invoice
        </Link>
      </div>

      <Suspense fallback={<InvoicesSkeleton />}>
        <InvoicesData scope={scope} />
      </Suspense>
    </div>
  );
}

async function InvoicesData({ scope }: { scope: { generatedBy?: string } }) {
  const [counts, invoices] = await Promise.all([
    fetchInvoiceCounts(scope),
    fetchInvoices(scope),
  ]);

  // Pending value: largest currency bucket (mixing currencies is wrong);
  // hint at any other currencies.
  const pendingByCurrency = invoices
    .filter((i) => i.status === "pending_review")
    .reduce<Record<string, number>>((acc, i) => {
      const cur = i.total_currency ?? "SAR";
      acc[cur] = (acc[cur] ?? 0) + (i.total ?? 0);
      return acc;
    }, {});
  const pendingBuckets = Object.entries(pendingByCurrency).sort((a, b) => b[1] - a[1]);
  const pendingHeadline = pendingBuckets[0] ?? null;
  const otherCurrencyCount = Math.max(0, pendingBuckets.length - 1);

  return (
    <>
      <InvoicesStats
        invoices={invoices}
        counts={counts}
        pendingHeadline={pendingHeadline}
        otherCurrencyCount={otherCurrencyCount}
      />
      <InvoicesList invoices={invoices} counts={counts} />
    </>
  );
}
