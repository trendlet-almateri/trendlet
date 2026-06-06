import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { NewTaxInvoiceForm } from "./tax-invoice-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "New tax invoice · Trendslet Operations" };

export default async function NewTaxInvoicePage() {
  await requireRole(["admin"]);

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-[var(--muted)]">
        <Link href="/tax-invoices" className="flex items-center gap-1 hover:text-[var(--ink)]">
          <ChevronLeft className="h-3 w-3" aria-hidden /> Tax invoices
        </Link>
      </nav>

      <header className="rise-in flex flex-col gap-1">
        <h1 className="text-h1 text-[var(--ink)]">New tax invoice</h1>
        <p className="text-[12px] text-[var(--muted)]">
          Pick an order — fees are looked up from the pricing table by brand and
          category. Override the match or enter fees manually, then generate the PDF.
        </p>
      </header>

      <NewTaxInvoiceForm />
    </div>
  );
}
