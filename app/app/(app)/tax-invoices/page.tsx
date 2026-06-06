import Link from "next/link";
import { Receipt, ChevronRight, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/system";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/lib/utils/currency";
import { relativeTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tax invoices · Trendslet Operations" };

type TaxInvoiceStatus = "draft" | "issued" | "needs_pricing";

type TaxInvoiceRow = {
  id: string;
  invoice_number: string;
  status: TaxInvoiceStatus;
  brand_name: string | null;
  category_ar: string | null;
  total_fee: number;
  currency: string;
  generated_at: string | null;
  order: { shopify_order_number: string | null } | null;
};

const STATUS_PILL: Record<TaxInvoiceStatus, string> = {
  draft: "bg-status-pending-bg text-status-pending-fg border-status-pending-border/40",
  issued: "bg-status-delivered-bg text-status-delivered-fg border-status-delivered-border/40",
  needs_pricing: "bg-status-danger-bg text-status-danger-fg border-status-danger-border/40",
};

const STATUS_LABEL: Record<TaxInvoiceStatus, string> = {
  draft: "draft",
  issued: "issued",
  needs_pricing: "needs pricing",
};

export default async function TaxInvoicesPage() {
  await requireRole(["admin"]);
  // tax_invoices is newer than the generated Database types; cast to bypass the
  // table-name union. Row shape is asserted via TaxInvoiceRow below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;

  const { data } = await sb
    .from("tax_invoices")
    .select(`
      id, invoice_number, status, brand_name, category_ar, total_fee, currency, generated_at,
      order:orders ( shopify_order_number )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  const invoices = (data ?? []) as unknown as TaxInvoiceRow[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <PageHeader title="Tax invoices" />
        <Link
          href="/tax-invoices/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-navy-deep px-4 text-[13px] font-medium text-white transition-all duration-200 hover:-translate-y-px hover:bg-[#063367] hover:shadow-[0_4px_12px_rgba(12,68,124,0.18)]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New tax invoice
        </Link>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No tax invoices yet"
          description="Create a tax invoice from an order — fees are looked up from the pricing table by brand and category."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {invoices.map((inv, i) => (
            <Link
              key={inv.id}
              href={`/tax-invoices/${inv.id}`}
              className="rise-in group flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)] transition-all hover:bg-[var(--hover)] active:scale-[0.998]"
              style={{ ["--stagger-index" as string]: String(Math.min(i, 12)) }}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono text-[13px] font-semibold text-[var(--ink)]">{inv.invoice_number}</span>
                  <span className={cn("pill border", STATUS_PILL[inv.status])}>{STATUS_LABEL[inv.status]}</span>
                </div>
                <div className="mt-0.5 text-[12px] text-[var(--ink-2)]">
                  {inv.order?.shopify_order_number ? <>Order {inv.order.shopify_order_number} · </> : null}
                  {inv.brand_name ?? "—"}
                  {inv.category_ar ? <> · <span dir="rtl">{inv.category_ar}</span></> : null}
                  {inv.generated_at ? <> · {relativeTime(inv.generated_at)}</> : null}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="mono font-medium text-[var(--ink)]">
                  {formatCurrency(inv.total_fee, inv.currency)}
                </span>
                <ChevronRight
                  className="h-4 w-4 text-[var(--muted-2)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ink-2)]"
                  aria-hidden
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
