import { Activity } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-role";
import { PageHeader } from "@/components/system";
import { createServiceClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/common/empty-state";
import { fullDateTime, relativeTime } from "@/lib/utils/date";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export const metadata = { title: "Activity log · Trendslet Operations" };

type Row = {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  description: string;
  created_at: string;
  user: { full_name: string | null; email: string } | null;
};

function getInitials(name: string | null | undefined, email: string): string {
  const base = (name && name.trim()) || email;
  const parts = base.split(/[\s@.]+/).slice(0, 2).filter(Boolean);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default async function ActivityLogPage() {
  await requireAdmin();
  const sb = createServiceClient();

  const { data, error } = await sb
    .from("activity_log")
    .select(`
      id, user_id, action, resource_type, resource_id, description, created_at,
      user:profiles ( full_name, email )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) console.error("[ActivityLog]", error);
  const rows = (data ?? []) as unknown as Row[];

  // Group by day
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const day = format(new Date(r.created_at), "yyyy-MM-dd");
    const list = groups.get(day) ?? [];
    list.push(r);
    groups.set(day, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Activity log" subtitle="Every action across the system · last 90 days" />

      {rows.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="System events will appear here as users sign in, change statuses, and approve invoices."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {Array.from(groups.entries()).map(([day, items]) => {
            const date = new Date(day);
            const today = new Date();
            const isToday = format(today, "yyyy-MM-dd") === day;
            const yesterdayDate = new Date(today);
            yesterdayDate.setDate(today.getDate() - 1);
            const isYesterday = format(yesterdayDate, "yyyy-MM-dd") === day;
            const label = isToday ? "Today" : isYesterday ? "Yesterday" : format(date, "EEEE · MMM d");
            return (
              <section key={day} className="flex flex-col gap-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</h2>
                <ul className="flex flex-col gap-1">
                  {items.map((r) => {
                    const userName = r.user?.full_name ?? r.user?.email ?? "System";
                    const initials = getInitials(r.user?.full_name, r.user?.email ?? "system");
                    return (
                      <li
                        key={r.id}
                        className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 shadow-[var(--shadow-sm)]"
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-navy text-[11px] font-medium text-white">
                          {initials}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-[13px] text-ink-primary">
                            <span className="font-medium">{userName}</span>{" "}
                            <span className="text-ink-secondary">{r.description}</span>
                          </span>
                          <span className="text-[11px] uppercase tracking-[0.4px] text-ink-tertiary">
                            {r.action.replace(/\./g, " · ")}
                          </span>
                        </div>
                        <time
                          dateTime={r.created_at}
                          title={fullDateTime(r.created_at)}
                          className="shrink-0 whitespace-nowrap text-[11px] text-ink-tertiary"
                        >
                          {relativeTime(r.created_at)}
                        </time>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
