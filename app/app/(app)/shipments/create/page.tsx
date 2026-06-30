import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { PageHeader } from "@/components/system";
import { CreateShipmentForm } from "./create-shipment-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create shipment · Trendslet Operations" };

export default async function CreateShipmentPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-[var(--muted)]">
        <Link href="/shipments" className="hover:text-[var(--ink)]">Shipments</Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <span className="text-[var(--ink-2)]">Create</span>
      </nav>
      <PageHeader title="Create DHL shipment" subtitle="Creates a REAL shipment. Fill every field, then confirm." />
      <CreateShipmentForm />
    </div>
  );
}
