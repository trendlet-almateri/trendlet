import { createServiceClient } from "@/lib/supabase/server";

export type InvoiceStatus = "draft" | "pending_review" | "approved" | "sent" | "rejected";
export type AiConfidence = "high" | "medium" | "low" | "failed";

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  ai_confidence: AiConfidence | null;
  cost: number;
  cost_currency: string;
  total: number;
  total_currency: string;
  profit_amount: number | null;
  profit_percent: number | null;
  generated_at: string | null;
  generated_by: string | null;
  created_at: string;
  order: {
    id: string;
    shopify_order_number: string;
    customer: { first_name: string | null; last_name: string | null } | null;
  } | null;
};

export async function fetchInvoices({
  status,
  limit = 100,
}: {
  status?: InvoiceStatus;
  limit?: number;
} = {}): Promise<InvoiceRow[]> {
  const sb = createServiceClient();
  let q = sb
    .from("customer_invoices")
    .select(`
      id, invoice_number, status, ai_confidence,
      cost, cost_currency, total, total_currency,
      profit_amount, profit_percent,
      generated_at, generated_by, created_at,
      order:orders ( id, shopify_order_number, customer:customers ( first_name, last_name ) )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    console.error("[fetchInvoices]", error);
    return [];
  }
  return (data ?? []) as unknown as InvoiceRow[];
}

export async function fetchInvoiceCounts(): Promise<Record<InvoiceStatus, number>> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("customer_invoices")
    .select("status");
  if (error) {
    console.error("[fetchInvoiceCounts]", error);
    return { draft: 0, pending_review: 0, approved: 0, sent: 0, rejected: 0 };
  }
  const counts: Record<InvoiceStatus, number> = {
    draft: 0, pending_review: 0, approved: 0, sent: 0, rejected: 0,
  };
  for (const r of (data ?? []) as { status: InvoiceStatus }[]) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  }
  return counts;
}
