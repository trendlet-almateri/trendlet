import Link from "next/link";
import {
  Receipt,
  Clock,
  FileCheck,
  Send,
  DollarSign,
  ChevronRight,
} from "lucide-react";
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

  // Sum pending invoice totals per currency (mixing currencies is wrong).
  // Show the largest bucket as the headline, hint at the rest.
  const pendingByCurrency = invoices
    .filter((i) => i.status === "pending_review")
    .reduce<Record<string, number>>((acc, i) => {
      const cur = i.total_currency ?? "SAR";
      acc[cur] = (acc[cur] ?? 0) + (i.total ?? 0);
      return acc;
    }, {});
  const pendingBuckets = Object.entries(pendingByCurrency).sort((a, b) => b[1] - a[1]);
  const pendingHeadline = pendingBuckets[0];
  const otherCurrencyCount = Math.max(0, pendingBuckets.length - 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Header — title + subtitle + sync badge, matching dashboard */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-h1 text-[var(--ink)]">Invoices</h1>
          <span className="text-[12px] text-[var(--muted)]">
            {totalCount.toLocaleString("en-US")} {totalCount === 1 ? "invoice" : "invoices"}
            {counts.pending_review > 0 && (
              <> · {counts.pending_review} awaiting review</>
            )}
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[11px] text-[var(--muted)] shadow-[var(--shadow-sm)]">
          <Clock className="h-3 w-3" aria-hidden />
          Synced 2 min ago
        </span>
      </header>

      {/* KPI Bento — asymmetric (2fr 2fr 2fr 3fr) so hero leads */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[2fr_2fr_2fr_3fr] lg:gap-3">
        <KpiTile
          index={0}
          icon={Clock}
          label="Awaiting review"
          value={counts.pending_review.toLocaleString("en-US")}
          tone={counts.pending_review > 0 ? "warn" : "default"}
        />
        <KpiTile
          index={1}
          icon={FileCheck}
          label="Approved"
          value={counts.approved.toLocaleString("en-US")}
        />
        <KpiTile
          index={2}
          icon={Send}
          label="Sent"
          value={counts.sent.toLocaleString("en-US")}
        />
        <KpiTile
          index={3}
          hero
          icon={DollarSign}
          label="Pending value"
          value={
            pendingHeadline
              ? formatCurrency(pendingHeadline[1], pendingHeadline[0], { compact: true })
              : "—"
          }
          hint={
            counts.pending_review === 0
              ? "no drafts to review"
              : `across ${counts.pending_review} ${counts.pending_review === 1 ? "draft" : "drafts"}${
                  otherCurrencyCount > 0
                    ? ` · + ${otherCurrencyCount} more ${otherCurrencyCount === 1 ? "currency" : "currencies"}`
                    : ""
                }`
          }
        />
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
          {invoices.map((inv, i) => {
            const customerName = inv.order?.customer
              ? [inv.order.customer.first_name, inv.order.customer.last_name].filter(Boolean).join(" ")
              : "—";
            const confidence = inv.ai_confidence ?? "high";
            return (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className={cn(
                  "rise-in group flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] border-l-2 bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)] transition-all hover:bg-[var(--hover)] active:scale-[0.998]",
                  CONFIDENCE_BORDER[confidence] ?? "border-l-status-pending-border",
                )}
                style={{ ["--stagger-index" as string]: Math.min(i, 12) }}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mono font-medium text-[var(--ink)]">{inv.invoice_number}</span>
                    <span className={cn("pill border", STATUS_PILL[inv.status])}>
                      {inv.status.replace("_", " ")}
                    </span>
                    {inv.ai_confidence && (
                      <span
                        className={cn(
                          "pill border",
                          inv.ai_confidence === "high" &&
                            "border-status-success-border/40 bg-status-success-bg text-status-success-fg",
                          inv.ai_confidence === "medium" &&
                            "border-status-sourcing-border/40 bg-status-sourcing-bg text-status-sourcing-fg",
                          (inv.ai_confidence === "low" || inv.ai_confidence === "failed") &&
                            "border-status-danger-border/40 bg-status-danger-bg text-status-danger-fg",
                        )}
                      >
                        AI {inv.ai_confidence}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-[var(--ink-2)]">
                    {inv.order ? <>From order {inv.order.shopify_order_number} · </> : null}
                    {customerName}
                    {inv.generated_at ? <> · {relativeTime(inv.generated_at)}</> : null}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end gap-0.5 text-right">
                    <span className="mono font-medium text-[var(--ink)]">
                      {formatCurrency(inv.total, inv.total_currency)}
                    </span>
                    {inv.profit_amount != null && (
                      <span className="mono text-[11px] text-[var(--muted)]">
                        Profit {formatCurrency(inv.profit_amount, inv.total_currency)}
                        {inv.profit_percent != null && (
                          <> · {Number(inv.profit_percent).toFixed(0)}%</>
                        )}
                      </span>
                    )}
                  </div>
                  <ChevronRight
                    className="h-4 w-4 text-[var(--muted-2)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ink-2)]"
                    aria-hidden
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Local KPI tile (matches dashboard <KpiCard> visually but inlined to
    avoid a cross-page coupling that would require touching the existing
    dashboard component) ────────────────────────────────────────────────── */

function KpiTile({
  index,
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  hero = false,
}: {
  index: number;
  icon: typeof Clock;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn";
  hero?: boolean;
}) {
  const isHero = hero;
  const isWarn = !isHero && tone === "warn";

  return (
    <div
      className={cn(
        "rise-in relative flex flex-col gap-2 overflow-hidden rounded-[var(--radius)] p-4",
        isHero && "bg-[#0f1419] text-white",
        isWarn &&
          "border border-[var(--amber)] [background:linear-gradient(180deg,#fff7ec_0%,#fff_60%)]",
        !isHero && !isWarn && "border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-sm)]",
      )}
      style={{ ["--stagger-index" as string]: index }}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.6px]",
          isHero ? "text-white/50" : isWarn ? "text-[var(--amber)]" : "text-[var(--muted)]",
        )}
      >
        <Icon className="h-3 w-3" aria-hidden />
        <span>{label}</span>
      </div>
      <span
        className={cn(
          "value-tick mono mt-1 text-[28px] font-semibold leading-none",
          isHero ? "text-white" : isWarn ? "text-[var(--amber)]" : "text-[var(--ink)]",
        )}
      >
        {value}
      </span>
      {hint && (
        <div
          className={cn(
            "text-[11px]",
            isHero ? "text-white/60" : isWarn ? "text-[var(--amber)]/80" : "text-[var(--muted)]",
          )}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
