import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils/currency";
import { fullDateTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

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
      generated_at, reviewed_at, rejection_reason, created_at,
      order:orders ( id, shopify_order_number, customer:customers ( first_name, last_name, email, default_address ) )
    `)
    .eq("id", params.id)
    .maybeSingle();

  if (error || !data) notFound();
  const inv = data as unknown as InvoiceDetail;

  const customerName = inv.order?.customer
    ? [inv.order.customer.first_name, inv.order.customer.last_name].filter(Boolean).join(" ")
    : "—";

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-ink-tertiary">
        <Link href="/invoices" className="hover:text-ink-primary">
          Invoices
        </Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <span className="text-ink-secondary">{inv.invoice_number}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 text-ink-primary">{inv.invoice_number}</h1>
          {inv.generated_at && (
            <span className="text-[12px] text-ink-tertiary">
              Generated {fullDateTime(inv.generated_at)}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-hint uppercase text-ink-tertiary">Total</span>
          <span className="text-[20px] font-medium tabular-nums text-ink-primary">
            {formatCurrency(inv.total, inv.total_currency)}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Left: PDF preview placeholder + AI reasoning */}
        <div className="flex flex-col gap-4">
          <section className="rounded-md border border-hairline bg-surface p-4">
            <h2 className="text-hint mb-2 uppercase text-ink-tertiary">PDF preview</h2>
            {inv.pdf_storage_path ? (
              <div className="text-[12px] text-ink-secondary">
                PDF rendering will arrive in Phase 6 (storage path: <code className="rounded-sm bg-neutral-100 px-1 py-0.5 text-[11px]">{inv.pdf_storage_path}</code>)
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-hairline-strong bg-neutral-50 px-6 py-12 text-center text-[12px] text-ink-tertiary">
                No PDF generated yet. Will render via PDF template once approved.
              </div>
            )}
          </section>

          {inv.ai_reasoning?.items && inv.ai_reasoning.items.length > 0 && (
            <section className="rounded-md border border-hairline bg-surface p-4">
              <h2 className="text-hint mb-2 uppercase text-ink-tertiary">AI reasoning</h2>
              <ul className="flex flex-col gap-2 text-[12px]">
                {inv.ai_reasoning.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-ink-tertiary tabular-nums">
                      {item.confidence != null ? `${item.confidence}%` : "—"}
                    </span>
                    <span className="text-ink-secondary">
                      <span className="font-medium text-ink-primary">{item.sku ?? "Item"}</span>
                      {item.reason ? <> — {item.reason}</> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Right rail: calculation + customer */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-md border border-hairline bg-surface p-4">
            <h2 className="text-hint mb-2 uppercase text-ink-tertiary">Calculation</h2>
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
                    <div className="my-1 border-t border-hairline" />
                    <Row label="Total" value={formatCurrency(inv.total, inv.total_currency)} bold />
                    {inv.profit_amount != null && (
                      <Row
                        label="Profit"
                        value={
                          <>
                            {formatCurrency(inv.profit_amount, inv.total_currency)}
                            {inv.profit_percent != null && (
                              <span className="ml-1 text-ink-tertiary">
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

          <section className="rounded-md border border-hairline bg-surface p-4">
            <h2 className="text-hint mb-2 uppercase text-ink-tertiary">Customer</h2>
            <div className="flex flex-col gap-1 text-[13px]">
              <span className="font-medium text-ink-primary">{customerName}</span>
              {inv.order?.customer?.email && (
                <span className="text-ink-secondary">{inv.order.customer.email}</span>
              )}
              {inv.order?.customer?.default_address && (
                <span className="text-[12px] text-ink-secondary">
                  {inv.order.customer.default_address.address1}, {inv.order.customer.default_address.city},{" "}
                  {inv.order.customer.default_address.country}
                </span>
              )}
              {inv.order && (
                <Link
                  href={`/orders/${inv.order.id}`}
                  className="mt-1 text-[12px] text-navy hover:underline"
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
      <dt className={cn("text-ink-secondary", muted && "text-ink-tertiary", hint && "text-[11px] uppercase tracking-[0.4px] text-ink-tertiary")}>
        {label}
      </dt>
      <dd className={cn("tabular-nums text-ink-primary", bold && "font-medium")}>{value}</dd>
    </div>
  );
}
