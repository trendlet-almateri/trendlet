import { CheckCircle2, AlertCircle, MinusCircle, XCircle, Circle } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { checkAll, type HealthStatus } from "@/lib/integrations/health";
import { PageHeader } from "@/components/system";
import { RecheckButton } from "./recheck-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Integrations · Trendslet Operations" };

const SERVICE_LABELS: Record<string, string> = {
  supabase: "Supabase (Postgres + Auth + Realtime)",
  shopify: "Shopify (orders webhook)",
  twilio: "Twilio WhatsApp (customer notifications)",
  openai: "OpenAI (invoice generation, deferred)",
  openrouter: "OpenRouter (AI router, deferred)",
  dhl: "DHL Express (bulk shipments)",
  hubstaff: "Hubstaff (time tracking)",
  resend: "Resend (transactional email)",
};

const STATUS_META: Record<
  HealthStatus,
  { label: string; icon: typeof CheckCircle2; pillClass: string; iconClass: string }
> = {
  ok: {
    label: "Connected",
    icon: CheckCircle2,
    pillClass: "bg-status-success-bg text-status-success-fg border-status-success-border/40",
    iconClass: "text-status-success-fg",
  },
  missing: {
    label: "Not configured",
    icon: MinusCircle,
    pillClass: "bg-status-pending-bg text-status-pending-fg border-status-pending-border/40",
    iconClass: "text-ink-tertiary",
  },
  auth_failed: {
    label: "Auth failed",
    icon: XCircle,
    pillClass: "bg-status-danger-bg text-status-danger-fg border-status-danger-border/40",
    iconClass: "text-status-danger-fg",
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    pillClass: "bg-status-danger-bg text-status-danger-fg border-status-danger-border/40",
    iconClass: "text-status-danger-fg",
  },
  skipped: {
    label: "Configured, not pinged",
    icon: Circle,
    pillClass: "bg-status-warehouse-bg text-status-warehouse-fg border-status-warehouse-border/40",
    iconClass: "text-status-warehouse-fg",
  },
};

export default async function IntegrationsPage() {
  await requireAdmin();
  const results = await checkAll();

  const okCount = results.filter((r) => r.status === "ok").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integrations"
        subtitle={`${okCount} of ${results.length} services connected · checks log to api_logs`}
        actions={<RecheckButton />}
      />

      <ul className="flex flex-col gap-2">
        {results.map((r) => {
          const meta = STATUS_META[r.status];
          const Icon = meta.icon;
          const label = SERVICE_LABELS[r.service] ?? r.service;
          return (
            <li
              key={r.service}
              className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]"
            >
              <Icon className={`h-4 w-4 shrink-0 ${meta.iconClass}`} aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-medium text-ink-primary">{label}</span>
                <span className="text-[11px] text-ink-tertiary">{r.detail}</span>
              </div>
              <span
                className={`shrink-0 rounded-sm border px-2 py-0.5 text-[10px] font-medium ${meta.pillClass}`}
              >
                {meta.label}
              </span>
              {r.latency_ms !== null && (
                <span className="shrink-0 text-[10px] tabular-nums text-ink-tertiary">
                  {r.latency_ms}ms
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
