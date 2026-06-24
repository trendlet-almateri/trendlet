import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/system";
import {
  TaxInvoicesList,
  TaxInvoicesStats,
  TaxInvoicesSkeleton,
  type TaxInvoiceRow,
} from "./tax-invoices-list";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tax invoices · Trendslet Operations" };

export default async function TaxInvoicesPage() {
  await requireRole(["admin"]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <PageHeader title="Tax Invoices" />
        <Link
          href="/tax-invoices/new"
          className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-[var(--accent)] px-4 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(15,20,25,0.10),0_4px_12px_-4px_rgba(12,68,124,0.35)] transition-all duration-200 hover:-translate-y-px hover:bg-[#0a3a6a] hover:shadow-[0_2px_4px_rgba(15,20,25,0.10),0_8px_18px_-6px_rgba(12,68,124,0.40)] active:translate-y-0"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New Tax Invoice
        </Link>
      </div>

      <Suspense fallback={<TaxInvoicesSkeleton />}>
        <TaxInvoicesData />
      </Suspense>
    </div>
  );
}

// Server component that fetches and feeds both the stats strip and the list.
async function TaxInvoicesData() {
  // tax_invoices is newer than the generated Database types; cast to bypass the
  // table-name union. Row shape is asserted via TaxInvoiceRow below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;

  const { data } = await sb
    .from("tax_invoices")
    .select(`
      id, invoice_number, status, total_fee, currency,
      created_at, generated_at,
      order:orders (
        shopify_order_number,
        customer:customers ( first_name, last_name ),
        sub_orders ( brand:brands ( name ) )
      )
    `)
    .order("created_at", { ascending: false }) // newest first
    .limit(200);

  const invoices = (data ?? []) as unknown as TaxInvoiceRow[];

  return (
    <>
      <TaxInvoicesStats invoices={invoices} />
      <TaxInvoicesList invoices={invoices} />
    </>
  );
}
