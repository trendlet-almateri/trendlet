import { Globe } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { EmptyState } from "@/components/common/empty-state";

export const dynamic = "force-dynamic";

export const metadata = { title: "EU fulfillment · Trendslet Operations" };

export default async function EuFulfillmentPage() {
  await requireRole(["fulfiller", "admin"]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 text-ink-primary">EU fulfillment</h1>
        <span className="text-[12px] text-ink-tertiary">
          Combined sourcing + warehouse cycle for EU brands
        </span>
      </div>

      <EmptyState
        icon={Globe}
        title="No EU fulfillers assigned yet"
        description="When a user with the fulfiller role is invited and assigned to EU brands, items will route here directly. For now, EU items appear in the regular Sourcing queue."
      />
    </div>
  );
}
