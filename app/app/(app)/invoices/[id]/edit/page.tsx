import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { EditInvoiceForm, type EditInvoiceInitial } from "./edit-invoice-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit invoice · Trendslet Operations" };

export default async function EditInvoicePage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const sb = createServiceClient();

  const { data: inv, error } = await sb
    .from("customer_invoices")
    .select(
      `id, invoice_number, status, language, cost, cost_currency, markup_percent,
       shipment_fee, tax_percent, total_currency,
       order:orders ( id, shopify_order_number, customer:customers ( first_name, last_name ) )`,
    )
    .eq("id", params.id)
    .maybeSingle();
  if (error || !inv) notFound();

  const status = (inv as { status: string }).status;
  if (status !== "draft" && status !== "pending_review" && status !== "rejected") {
    // Locked once approved or sent — bounce back to detail page.
    redirect(`/invoices/${params.id}`);
  }

  const { data: items } = await sb
    .from("customer_invoice_items")
    .select("title, sku, quantity, unit_price, sub_order_id")
    .eq("customer_invoice_id", params.id)
    .order("position", { ascending: true });

  // Legacy invoices (created before customer_invoice_items existed) won't
  // have rows here. Fall back to the order's sub_orders for an initial set.
  let initialItems: EditInvoiceInitial["items"] = (items ?? []).map((r) => {
    const row = r as {
      title: string;
      sku: string | null;
      quantity: number;
      unit_price: number;
      sub_order_id: string | null;
    };
    return {
      title: row.title,
      sku: row.sku ?? "",
      quantity: row.quantity,
      unit_price: Number(row.unit_price),
      sub_order_id: row.sub_order_id,
    };
  });

  if (initialItems.length === 0) {
    const orderId = (inv as { order: { id: string } | null }).order?.id;
    if (orderId) {
      const { data: subs } = await sb
        .from("sub_orders")
        .select("id, product_title, sku, quantity, unit_price")
        .eq("order_id", orderId);
      initialItems = (subs ?? []).map((s) => {
        const r = s as {
          id: string;
          product_title: string;
          sku: string | null;
          quantity: number;
          unit_price: number | null;
        };
        return {
          title: r.product_title,
          sku: r.sku ?? "",
          quantity: r.quantity,
          unit_price: Number(r.unit_price ?? 0),
          sub_order_id: r.id,
        };
      });
    }
  }

  const initial: EditInvoiceInitial = {
    id: (inv as { id: string }).id,
    invoice_number: (inv as { invoice_number: string }).invoice_number,
    status: status as "draft" | "pending_review" | "rejected",
    language: (inv as { language: "en" | "ar" | "bilingual" }).language,
    cost: Number((inv as { cost: number }).cost),
    cost_currency: (inv as { cost_currency: string }).cost_currency,
    markup_percent: Number((inv as { markup_percent: number }).markup_percent),
    shipment_fee: Number((inv as { shipment_fee: number }).shipment_fee),
    tax_percent: Number((inv as { tax_percent: number }).tax_percent),
    total_currency: (inv as { total_currency: string }).total_currency,
    items: initialItems,
  };

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-[var(--muted)]">
        <Link
          href={`/invoices/${initial.id}`}
          className="flex items-center gap-1 hover:text-[var(--ink)]"
        >
          <ChevronLeft className="h-3 w-3" aria-hidden /> {initial.invoice_number}
        </Link>
      </nav>

      <header className="rise-in flex flex-col gap-1">
        <h1 className="text-h1 text-[var(--ink)]">Edit {initial.invoice_number}</h1>
        <p className="text-[12px] text-[var(--muted)]">
          Status: <span className="font-medium">{initial.status.replace("_", " ")}</span>.
          Editable until admin approval.
        </p>
      </header>

      <EditInvoiceForm initial={initial} />
    </div>
  );
}
