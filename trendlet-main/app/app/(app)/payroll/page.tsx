import { Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { EmptyState } from "@/components/common/empty-state";
import { SyncHubstaffButton } from "./sync-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Payroll · Trendslet Operations" };

export default async function PayrollPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 text-ink-primary">Payroll</h1>
          <span className="text-[12px] text-ink-tertiary">
            Hubstaff hours · hourly rate × tracked time
          </span>
        </div>
        <SyncHubstaffButton />
      </div>

      <EmptyState
        icon={Wallet}
        title="Hubstaff integration not yet connected"
        description="Once Hubstaff API credentials are set in .env.local, the hourly cron job will sync time entries here. Hourly rates are configured in Team & roles."
      />
    </div>
  );
}
