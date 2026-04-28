import Link from "next/link";
import { Receipt } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { fetchInvoices, fetchInvoiceCounts, type InvoiceStatus } from "@/lib/queries/invoices";
import { FilterTabs } from "@/components/orders/filter-tabs";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/lib/utils/currency";
import { relativeTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Invoices · Trendslet Operations" };

const VALID = ["all", "pending_review", "approved", "sent", "rejected"] as const;
type FilterKey = (typeof VALID)[number];

const CONFIDENCE_BORDER: Record<string, string> = {
  high: "border-l-status-success-border",
  medium: "border-l-status-sourcing-border",
  low: "border-l-status-danger-border",
  failed: "border-l-status-danger-border",
};

const STATUS_PILL: Record<InvoiceStatus, string> = {
  draft: "bg-status-pending-bg text-status-pending-fg border-status-pending-border/40",
  pending_review: "bg-status-sourcing-bg text-status-sourcing-fg border-status-sourcing-border/40",
  approved: "bg-status-warehouse-bg text-status-warehouse-fg border-status-warehouse-border/40",
  sent: "bg-status-delivered-bg text-status-delivered-fg border-status-delivered-border/40",
  rejected: "bg-status-danger-bg text-status-danger-fg border-status-danger-border/40",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  await requireAdmin();

  const requested = searchParams.filter as FilterKey | undefined;
  const filter: FilterKey = requested && VALID.includes(requested) ? requested : "all";

  const [counts, invoices] = await Promise.all([
    fetchInvoiceCounts(),
    fetchInvoices(filter === "all" ? {} : { status: filter as InvoiceStatus }),
  ]);

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const pendingValue = invoices
    .filter((i) => i.status === "pending_review")
    .reduce((sum, i) => sum + (i.total ?? 0), 0);
  const pendingCurrency = invoices.find((i) => i.status === "pending_review")?.total_currency ?? "SAR";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1 text-ink-primary">Invoices</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-md border border-hairline bg-surface p-4">
          <span className="text-hint uppercase text-ink-tertiary">Awaiting review</span>
          <div className="mt-1 text-[24px] font-medium tabular-nums text-ink-primary">
            {counts.pending_review}
          </div>
        </div>
        <div className="rounded-md border border-hairline bg-surface p-4">
          <span className="text-hint uppercase text-ink-tertiary">Approved</span>
          <div className="mt-1 text-[24px] font-medium tabular-nums text-ink-primary">
            {counts.approved}
          </div>
        </div>
        <div className="rounded-md border border-hairline bg-surface p-4">
          <span className="text-hint uppercase text-ink-tertiary">Sent</span>
          <div className="mt-1 text-[24px] font-medium tabular-nums text-ink-primary">
            {counts.sent}
          </div>
        </div>
        <div className="rounded-md bg-navy-deep p-4 text-white">
          <span className="text-hint uppercase text-white/60">Pending value</span>
          <div className="mt-1 text-[24px] font-medium tabular-nums">
            {pendingValue > 0 ? formatCurrency(pendingValue, pendingCurrency, { compact: true }) : "—"}
          </div>
          <div className="mt-0.5 text-[11px] text-white/70">across {counts.pending_review} drafts</div>
        </div>
      </div>

      <FilterTabs
        basePath="/invoices"
        active={filter}
        tabs={[
          { key: "all", label: "All", count: totalCount },
          { key: "pending_review", label: "Pending review", count: counts.pending_review },
          { key: "approved", label: "Approved", count: counts.approved },
          { key: "sent", label: "Sent", count: counts.sent },
          { key: "rejected", label: "Rejected", count: counts.rejected },
        ]}
      />

      {invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices yet"
          description="Customer invoices are generated after a supplier invoice is uploaded and items are mapped."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {invoices.map((inv) => {
            const customerName = inv.order?.customer
              ? [inv.order.customer.first_name, inv.order.customer.last_name].filter(Boolean).join(" ")
              : "—";
            const confidence = inv.ai_confidence ?? "high";
            return (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-md border border-hairline border-l-2 bg-surface p-4 transition-colors hover:bg-neutral-50/50",
                  CONFIDENCE_BORDER[confidence] ?? "border-l-status-pending-border",
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink-primary">{inv.invoice_number}</span>
                    <span className={cn("pill border", STATUS_PILL[inv.status])}>
                      {inv.status.replace("_", " ")}
                    </span>
                    {inv.ai_confidence && (
                      <span
                        className={cn(
                          "pill border",
                          inv.ai_confidence === "high" && "border-status-success-border/40 bg-status-success-bg text-status-success-fg",
                          inv.ai_confidence === "medium" && "border-status-sourcing-border/40 bg-status-sourcing-bg text-status-sourcing-fg",
                          (inv.ai_confidence === "low" || inv.ai_confidence === "failed") && "border-status-danger-border/40 bg-status-danger-bg text-status-danger-fg",
                        )}
                      >
                        AI {inv.ai_confidence}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-ink-secondary">
                    {inv.order ? <>From order {inv.order.shopify_order_number} · </> : null}
                    {customerName}
                    {inv.generated_at ? <> · {relativeTime(inv.generated_at)}</> : null}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 text-right tabular-nums">
                  <span className="font-medium text-ink-primary">
                    {formatCurrency(inv.total, inv.total_currency)}
                  </span>
                  {inv.profit_amount != null && (
                    <span className="text-[11px] text-ink-tertiary">
                      Profit {formatCurrency(inv.profit_amount, inv.total_currency)}
                      {inv.profit_percent != null && <> · {Number(inv.profit_percent).toFixed(0)}%</>}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
