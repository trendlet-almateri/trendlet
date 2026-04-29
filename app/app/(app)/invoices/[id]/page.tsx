import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText, Brain } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { getCustomerInvoiceSignedUrl } from "@/lib/storage/customer-invoices";
import { isZohoConfigured } from "@/lib/integrations/zoho-mail";
import { formatCurrency } from "@/lib/utils/currency";
import { fullDateTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { InvoiceActions } from "./invoice-actions";
import { RegeneratePdfButton } from "./regenerate-pdf-button";

export const dynamic = "force-dynamic";

type InvoiceDetail = {
  id: string;
  invoice_number: string;
  status: "draft" | "pending_review" | "approved" | "sent" | "rejected";
  ai_confidence: "high" | "medium" | "low" | "failed" | null;
  ai_reasoning: { items?: { sku?: string; reason?: string; confidence?: number }[] } | null;
  cost: number;
  cost_currency: string;
  markup_percent: number;
  item_price: number;
  shipment_fee: number;
  tax_percent: number;
  tax_amount: number;
  total: number;
  total_currency: string;
  profit_amount: number | null;
  profit_percent: number | null;
  language: "en" | "ar" | "bilingual";
  pdf_storage_path: string | null;
  generated_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  sent_at: string | null;
  sent_to_email: string | null;
  created_at: string;
  order: {
    id: string;
    shopify_order_number: string;
    customer: {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      default_address: { address1?: string; city?: string; country?: string } | null;
    } | null;
  } | null;
};

const STATUS_PILL: Record<InvoiceDetail["status"], string> = {
  draft: "border-status-pending-border/40 bg-status-pending-bg text-status-pending-fg",
  pending_review: "border-status-sourcing-border/40 bg-status-sourcing-bg text-status-sourcing-fg",
  approved: "border-status-warehouse-border/40 bg-status-warehouse-bg text-status-warehouse-fg",
  sent: "border-status-delivered-border/40 bg-status-delivered-bg text-status-delivered-fg",
  rejected: "border-status-danger-border/40 bg-status-danger-bg text-status-danger-fg",
};

export async function generateMetadata({ params }: { params: { id: string } }) {
  const sb = createServiceClient();
  const { data } = await sb
    .from("customer_invoices")
    .select("invoice_number")
    .eq("id", params.id)
    .maybeSingle();
  const num = (data as { invoice_number?: string } | null)?.invoice_number;
  return { title: num ? `${num} · Trendslet Operations` : "Invoice · Trendslet Operations" };
}

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const sb = createServiceClient();

  const { data, error } = await sb
    .from("customer_invoices")
    .select(`
      id, invoice_number, status, ai_confidence, ai_reasoning,
      cost, cost_currency, markup_percent, item_price, shipment_fee,
      tax_percent, tax_amount, total, total_currency,
      profit_amount, profit_percent, language, pdf_storage_path,
      generated_at, reviewed_at, rejection_reason, sent_at, sent_to_email, created_at,
      order:orders ( id, shopify_order_number, customer:customers ( first_name, last_name, email, default_address ) )
    `)
    .eq("id", params.id)
    .maybeSingle();

  if (error || !data) notFound();
  const inv = data as unknown as InvoiceDetail;

  const customerName = inv.order?.customer
    ? [inv.order.customer.first_name, inv.order.customer.last_name].filter(Boolean).join(" ")
    : "—";
  const customerEmail = inv.order?.customer?.email ?? null;
  const pdfSignedUrl = inv.pdf_storage_path
    ? await getCustomerInvoiceSignedUrl(inv.pdf_storage_path)
    : null;
  const canRegenerate = inv.status === "approved" || inv.status === "sent";
  const zohoLive = isZohoConfigured();

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-[var(--muted)]">
        <Link href="/invoices" className="hover:text-[var(--ink)]">
          Invoices
        </Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <span className="text-[var(--ink-2)]">{inv.invoice_number}</span>
      </nav>

      <header className="rise-in flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h1 text-[var(--ink)]">{inv.invoice_number}</h1>
            <span className={cn("pill border", STATUS_PILL[inv.status])}>
              {inv.status.replace("_", " ")}
            </span>
          </div>
          {inv.generated_at && (
            <span className="text-[12px] text-[var(--muted)]">
              Generated {fullDateTime(inv.generated_at)}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.4px] text-[var(--muted)]">
            Total
          </span>
          <span className="mono text-[22px] font-semibold text-[var(--ink)]">
            {formatCurrency(inv.total, inv.total_currency)}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Left: PDF preview placeholder + AI reasoning */}
        <div className="flex flex-col gap-4">
          <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                <FileText className="h-3 w-3" aria-hidden /> PDF preview
              </h2>
              {canRegenerate && <RegeneratePdfButton invoiceId={inv.id} />}
            </div>
            {pdfSignedUrl ? (
              <iframe
                src={pdfSignedUrl}
                title={`Invoice ${inv.invoice_number} PDF`}
                className="h-[640px] w-full rounded-md border border-[var(--line)] bg-white"
              />
            ) : inv.pdf_storage_path ? (
              <div className="rounded-md border border-dashed border-[var(--line)] bg-[var(--bg)] px-6 py-12 text-center text-[12px] text-[var(--muted)]">
                PDF stored at <code className="mono">{inv.pdf_storage_path}</code> —
                couldn&apos;t generate signed URL. Try refreshing.
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-[var(--line)] bg-[var(--bg)] px-6 py-12 text-center text-[12px] text-[var(--muted)]">
                No PDF generated yet. The customer-facing PDF is rendered when the
                invoice is approved.
              </div>
            )}
          </section>

          {inv.ai_reasoning?.items && inv.ai_reasoning.items.length > 0 && (
            <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
              <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                <Brain className="h-3 w-3" aria-hidden /> AI reasoning
              </h2>
              <ul className="flex flex-col gap-2 text-[12px]">
                {inv.ai_reasoning.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mono text-[var(--muted)]">
                      {item.confidence != null ? `${item.confidence}%` : "—"}
                    </span>
                    <span className="text-[var(--ink-2)]">
                      <span className="font-medium text-[var(--ink)]">{item.sku ?? "Item"}</span>
                      {item.reason ? <> — {item.reason}</> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Right rail: actions, calculation, customer */}
        <aside className="flex flex-col gap-4">
          <InvoiceActions
            invoiceId={inv.id}
            status={inv.status}
            rejectionReason={inv.rejection_reason}
            sentAt={inv.sent_at}
            sentToEmail={inv.sent_to_email}
            customerEmail={customerEmail}
            zohoLive={zohoLive}
          />

          <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
            <h2 className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
              Calculation
            </h2>
            <dl className="flex flex-col gap-1.5 text-[13px]">
              {(() => {
                // item_price is post-markup. Pre-markup converted cost is:
                //   item_price / (1 + markup_percent/100)
                // For same-currency invoices that equals inv.cost; for FX it's the
                // converted-cost-before-markup.
                const markupRate = 1 + Number(inv.markup_percent) / 100;
                const convertedCost =
                  markupRate > 0 ? inv.item_price / markupRate : inv.item_price;
                const markupAmount = inv.item_price - convertedCost;
                const isFx = inv.cost_currency !== inv.total_currency;

                return (
                  <>
                    <Row
                      label={`Cost (${inv.cost_currency})`}
                      value={formatCurrency(inv.cost, inv.cost_currency)}
                    />
                    {isFx && (
                      <Row
                        label={`Converted to ${inv.total_currency}`}
                        value={formatCurrency(convertedCost, inv.total_currency)}
                        hint
                      />
                    )}
                    <Row
                      label={`Markup ${Number(inv.markup_percent).toFixed(0)}%`}
                      value={`+${formatCurrency(markupAmount, inv.total_currency)}`}
                      muted
                    />
                    {inv.shipment_fee > 0 && (
                      <Row label="Shipping" value={`+${formatCurrency(inv.shipment_fee, inv.total_currency)}`} muted />
                    )}
                    {inv.tax_amount > 0 && (
                      <Row
                        label={`VAT ${Number(inv.tax_percent).toFixed(0)}%`}
                        value={`+${formatCurrency(inv.tax_amount, inv.total_currency)}`}
                        muted
                      />
                    )}
                    <div className="my-1 border-t border-[var(--line)]" />
                    <Row label="Total" value={formatCurrency(inv.total, inv.total_currency)} bold />
                    {inv.profit_amount != null && (
                      <Row
                        label="Profit"
                        value={
                          <>
                            {formatCurrency(inv.profit_amount, inv.total_currency)}
                            {inv.profit_percent != null && (
                              <span className="ml-1 text-[var(--muted)]">
                                ({Number(inv.profit_percent).toFixed(0)}%)
                              </span>
                            )}
                          </>
                        }
                      />
                    )}
                  </>
                );
              })()}
            </dl>
          </section>

          <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
            <h2 className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
              Customer
            </h2>
            <div className="flex flex-col gap-1 text-[13px]">
              <span className="font-medium text-[var(--ink)]">{customerName}</span>
              {inv.order?.customer?.email && (
                <span className="text-[var(--ink-2)]">{inv.order.customer.email}</span>
              )}
              {inv.order?.customer?.default_address && (
                <span className="text-[12px] text-[var(--ink-2)]">
                  {inv.order.customer.default_address.address1}, {inv.order.customer.default_address.city},{" "}
                  {inv.order.customer.default_address.country}
                </span>
              )}
              {inv.order && (
                <Link
                  href={`/orders/${inv.order.id}`}
                  className="mt-1 text-[12px] text-[var(--accent)] hover:underline"
                >
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

function Row({
  label,
  value,
  bold,
  muted,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  muted?: boolean;
  hint?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt
        className={cn(
          "text-[var(--ink-2)]",
          muted && "text-[var(--muted)]",
          hint && "text-[11px] uppercase tracking-[0.4px] text-[var(--muted)]",
        )}
      >
        {label}
      </dt>
      <dd className={cn("mono text-[var(--ink)]", bold && "font-medium")}>{value}</dd>
    </div>
  );
}
