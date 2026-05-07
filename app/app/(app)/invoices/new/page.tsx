import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { NewInvoiceForm } from "./new-invoice-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "New invoice · Trendslet Operations" };

export default async function NewInvoicePage() {
  // Admin-only entry. Sourcing/EU will get role-specific entry points later.
  await requireAdmin();

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-[var(--muted)]">
        <Link
          href="/invoices"
          className="flex items-center gap-1 hover:text-[var(--ink)]"
        >
          <ChevronLeft className="h-3 w-3" aria-hidden /> Invoices
        </Link>
      </nav>

      <header className="rise-in flex flex-col gap-1">
        <h1 className="text-h1 text-[var(--ink)]">New invoice</h1>
        <p className="text-[12px] text-[var(--muted)]">
          Search a sub-order, pull customer + product details, edit anything,
          then save as draft or submit for review.
        </p>
      </header>

      <NewInvoiceForm />
    </div>
  );
}
