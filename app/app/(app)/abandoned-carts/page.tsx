import { ShoppingCart, Mail, Phone, ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/system";
import { EmptyState } from "@/components/common/empty-state";
import { formatCurrency } from "@/lib/utils/currency";
import { relativeTime } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

export const metadata = { title: "Abandoned carts · Trendslet Operations" };

type LineItem = { title: string; quantity: number; price: number | null };

type AbandonedRow = {
  id: string;
  email: string | null;
  phone: string | null;
  customer_name: string | null;
  currency: string | null;
  total: number;
  line_items: LineItem[];
  recovery_url: string | null;
  abandoned_at: string | null;
};

export default async function AbandonedCartsPage() {
  await requireRole(["admin"]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;

  const { data } = await sb
    .from("abandoned_checkouts")
    .select(
      "id, email, phone, customer_name, currency, total, line_items, recovery_url, abandoned_at",
    )
    .eq("recovered", false)
    .order("abandoned_at", { ascending: false, nullsFirst: false })
    .limit(200);

  const carts = (data ?? []) as AbandonedRow[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Abandoned carts"
        subtitle={
          <>
            {carts.length} {carts.length === 1 ? "open cart" : "open carts"} · follow up manually
          </>
        }
      />

      {carts.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No abandoned carts"
          description="Checkouts that customers start but don't complete will appear here."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {carts.map((c, i) => {
            const itemCount = c.line_items?.reduce((s, it) => s + (it.quantity ?? 0), 0) ?? 0;
            const itemSummary =
              (c.line_items ?? []).map((it) => `${it.quantity}× ${it.title}`).join(", ") || "—";
            return (
              <div
                key={c.id}
                className="rise-in flex flex-wrap items-start gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]"
                style={{ ["--stagger-index" as string]: String(Math.min(i, 12)) }}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[13px] font-semibold text-[var(--ink)]">
                      {c.customer_name || "Unknown customer"}
                    </span>
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="flex items-center gap-1 text-[12px] text-[var(--ink-2)] hover:text-[var(--accent)] hover:underline"
                      >
                        <Mail className="h-3 w-3" aria-hidden /> {c.email}
                      </a>
                    )}
                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        className="flex items-center gap-1 text-[12px] text-[var(--ink-2)] hover:text-[var(--accent)] hover:underline"
                      >
                        <Phone className="h-3 w-3" aria-hidden /> {c.phone}
                      </a>
                    )}
                  </div>
                  <div className="text-[12px] text-[var(--ink-2)]">
                    {itemCount} {itemCount === 1 ? "item" : "items"} · {itemSummary}
                  </div>
                  {c.abandoned_at && (
                    <div className="text-[11px] text-[var(--muted)]">
                      Abandoned {relativeTime(c.abandoned_at)}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <span className="mono font-medium text-[var(--ink)]">
                    {formatCurrency(c.total, c.currency ?? "SAR")}
                  </span>
                  {c.recovery_url && (
                    <a
                      href={c.recovery_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-hairline bg-white px-2.5 py-1 text-[11px] font-medium text-ink-primary hover:bg-neutral-50"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden /> Recovery link
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
