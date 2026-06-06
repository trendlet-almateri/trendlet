import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { getTaxInvoiceSignedUrl } from "@/lib/storage/tax-invoices";
import { formatCurrency } from "@/lib/utils/currency";
import { fullDateTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type TaxInvoiceDetail = {
  id: string;
  invoice_number: string;
  status: "draft" | "issued";
  brand_name: string | null;
  category_ar: string | null;
  service_fee_net: number;
  service_fee_vat: number;
  service_fee_with_vat: number;
  shipping_customs_fee: number;
  total_fee: number;
  currency: string;
  pdf_storage_path: string | null;
  generated_at: string | null;
  order: {
    id: string;
    shopify_order_number: string | null;
    customer: { first_name: string | null; last_name: string | null; email: string | null } | null;
  } | null;
};

const STATUS_PILL: Record<TaxInvoiceDetail["status"], string> = {
  draft: "border-status-pending-border/40 bg-status-pending-bg text-status-pending-fg",
  issued: "border-status-delivered-border/40 bg-status-delivered-bg text-status-delivered-fg",
};

export async function generateMetadata({ params }: { params: { id: string } }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;
  const { data } = await sb
    .from("tax_invoices")
    .select("invoice_number")
    .eq("id", params.id)
    .maybeSingle();
  const num = (data as { invoice_number?: string } | null)?.invoice_number;
  return { title: num ? `${num} · Trendslet Operations` : "Tax invoice · Trendslet Operations" };
}

export default async function TaxInvoiceDetailPage({ params }: { params: { id: string } }) {
  await requireRole(["admin"]);
  // tax_invoices is newer than the generated Database types; cast to bypass the
  // table-name union. Row shape is asserted via TaxInvoiceDetail below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;

  const { data, error } = await sb
    .from("tax_invoices")
    .select(`
      id, invoice_number, status, brand_name, category_ar,
      service_fee_net, service_fee_vat, service_fee_with_vat, shipping_customs_fee,
      total_fee, currency, pdf_storage_path, generated_at,
      order:orders ( id, shopify_order_number, customer:customers ( first_name, last_name, email ) )
    `)
    .eq("id", params.id)
    .maybeSingle();

  if (error || !data) notFound();
  const inv = data as unknown as TaxInvoiceDetail;

  const customerName = inv.order?.customer
    ? [inv.order.customer.first_name, inv.order.customer.last_name].filter(Boolean).join(" ")
    : "—";
  const pdfSignedUrl = inv.pdf_storage_path
    ? await getTaxInvoiceSignedUrl(inv.pdf_storage_path)
    : null;

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-[var(--muted)]">
        <Link href="/tax-invoices" className="hover:text-[var(--ink)]">Tax invoices</Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <span className="text-[var(--ink-2)]">{inv.invoice_number}</span>
      </nav>

      <header className="rise-in flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h1 text-[var(--ink)]">{inv.invoice_number}</h1>
            <span className={cn("pill border", STATUS_PILL[inv.status])}>{inv.status}</span>
          </div>
          {inv.generated_at && (
            <span className="text-[12px] text-[var(--muted)]">
              Generated {fullDateTime(inv.generated_at)}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Total</span>
          <span className="mono text-[22px] font-semibold text-[var(--ink)]">
            {formatCurrency(inv.total_fee, inv.currency)}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* PDF */}
        <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            <FileText className="h-3 w-3" aria-hidden /> PDF
          </h2>
          {pdfSignedUrl ? (
            <iframe
              src={pdfSignedUrl}
              title={`Tax invoice ${inv.invoice_number} PDF`}
              className="h-[640px] w-full rounded-md border border-[var(--line)] bg-white"
            />
          ) : (
            <div className="rounded-md border border-dashed border-[var(--line)] bg-[var(--bg)] px-6 py-12 text-center text-[12px] text-[var(--muted)]">
              No PDF available.
            </div>
          )}
        </section>

        {/* Right rail */}
        <aside className="flex flex-col gap-4">
          <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Fees</h2>
            <dl className="flex flex-col gap-1.5 text-[13px]">
              <Row label="Service fee (net)" value={formatCurrency(inv.service_fee_net, inv.currency)} />
              <Row label="VAT (15%)" value={formatCurrency(inv.service_fee_vat, inv.currency)} />
              <Row label="Service incl. VAT" value={formatCurrency(inv.service_fee_with_vat, inv.currency)} />
              <Row label="Shipping & customs" value={formatCurrency(inv.shipping_customs_fee, inv.currency)} />
              <div className="my-1 border-t border-[var(--line)]" />
              <Row label="Total" value={formatCurrency(inv.total_fee, inv.currency)} bold />
            </dl>
          </section>

          <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Item</h2>
            <div className="flex flex-col gap-1 text-[13px]">
              <span className="font-medium text-[var(--ink)]">{inv.brand_name ?? "—"}</span>
              {inv.category_ar && <span className="text-[var(--ink-2)]" dir="rtl">{inv.category_ar}</span>}
            </div>
          </section>

          <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Customer</h2>
            <div className="flex flex-col gap-1 text-[13px]">
              <span className="font-medium text-[var(--ink)]">{customerName}</span>
              {inv.order?.customer?.email && (
                <span className="text-[var(--ink-2)]">{inv.order.customer.email}</span>
              )}
              {inv.order && (
                <Link href={`/orders/${inv.order.id}`} className="mt-1 text-[12px] text-[var(--accent)] hover:underline">
                  View order {inv.order.shopify_order_number} →
                </Link>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[var(--ink-2)]">{label}</dt>
      <dd className={cn("mono text-[var(--ink)]", bold && "font-medium")}>{value}</dd>
    </div>
  );
}
