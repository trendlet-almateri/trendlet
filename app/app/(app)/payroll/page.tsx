import { Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { EmptyState } from "@/components/common/empty-state";
import { SyncHubstaffButton } from "./sync-button";
import { PageHeader } from "@/components/system";

export const dynamic = "force-dynamic";

export const metadata = { title: "Payroll · Trendslet Operations" };

export default async function PayrollPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payroll"
        subtitle="Hubstaff hours · hourly rate × tracked time"
        actions={<SyncHubstaffButton />}
      />

      <EmptyState
        icon={Wallet}
        title="Hubstaff integration not yet connected"
        description="Once Hubstaff API credentials are set in .env.local, the hourly cron job will sync time entries here. Hourly rates are configured in Team & roles."
      />
    </div>
  );
}
