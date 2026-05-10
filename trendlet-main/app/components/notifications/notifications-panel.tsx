"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { Bell, Check, AlertCircle, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/utils/date";
import type { NotificationRow } from "@/lib/queries/notifications";

type Props = {
  initialNotifications: NotificationRow[];
  userId: string;
  channelKey: string;
};

const SEVERITY_ICON: Record<NotificationRow["severity"], React.ComponentType<{ className?: string }>> = {
  critical: AlertCircle,
  warning:  AlertTriangle,
  info:     Info,
  success:  CheckCircle,
};

const SEVERITY_COLOR: Record<NotificationRow["severity"], string> = {
  critical: "text-[var(--rose)]",
  warning:  "text-[var(--amber)]",
  info:     "text-[var(--blue)]",
  success:  "text-[var(--green)]",
};

export function NotificationsPanel({ initialNotifications, userId, channelKey }: Props) {
  const router = useRouter();
  const [items, setItems] = React.useState<NotificationRow[]>(initialNotifications);
  const [open, setOpen] = React.useState(false);
  const supabaseRef = React.useRef<ReturnType<typeof createClient> | null>(null);

  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  React.useEffect(() => {
    const channel = supabase
      .channel(`notifications-bell-${channelKey}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as NotificationRow;
          setItems((prev) => [row, ...prev].slice(0, 50));
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, userId, channelKey]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  async function markAllRead() {
    if (unreadCount === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase.from("notifications").update({ read_at: now }).is("read_at", null);
    router.refresh();
  }

  async function markOneRead(id: string) {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: now } : n)));
    await supabase.from("notifications").update({ read_at: now }).eq("id", id);
    router.refresh();
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded-md transition-colors",
            "text-[#6e7581] hover:bg-white/[0.06] hover:text-[#e2e4e8]",
            open && "bg-white/[0.06] text-[#e2e4e8]",
          )}
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        >
          <Bell className="h-4 w-4" aria-hidden />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--rose)]"
            />
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={12}
          className={cn(
            "popover-dark z-50 w-[380px] overflow-hidden rounded-xl",
            "border border-white/[0.08] bg-[#17191d]",
            "shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-white">Alerts</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[var(--rose)] px-1.5 py-px text-[10px] font-semibold text-white tabular-nums">
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="text-[11px] text-[#6e7581] transition-colors hover:text-white disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-[12px] text-[#6e7581]">
                You&apos;re all caught up.
              </div>
            ) : (
              <ul>
                {items.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onActivate={() => {
                      if (!n.read_at) void markOneRead(n.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5">
            <Link
              href="/activity-log"
              className="text-[11px] text-[#6e7581] transition-colors hover:text-white"
            >
              View all activity
            </Link>
            <Link
              href="/preferences#notifications"
              className="text-[11px] text-[#6e7581] transition-colors hover:text-white"
            >
              Notification settings
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NotificationItem({
  notification: n,
  onActivate,
}: {
  notification: NotificationRow;
  onActivate: () => void;
}) {
  const isUnread = !n.read_at;
  const Icon = SEVERITY_ICON[n.severity];

  const body = (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 transition-colors",
        isUnread ? "bg-white/[0.03]" : "bg-transparent",
        n.href && "hover:bg-white/[0.05]",
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", SEVERITY_COLOR[n.severity])} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="flex-1 text-[13px] font-medium text-white/90">{n.title}</span>
          {isUnread && (
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--blue)]" />
          )}
        </div>
        {n.description && (
          <p className="mt-0.5 line-clamp-1 text-[12px] text-[#9aa1aa]">{n.description}</p>
        )}
        <span className="mt-1 block text-[10px] text-[#6e7581]">
          {relativeTime(n.created_at)}
        </span>
      </div>
    </div>
  );

  return (
    <li className="border-b border-white/[0.05] last:border-b-0">
      {n.href ? (
        <Link href={n.href} onClick={onActivate} className="block">
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onActivate} className="block w-full text-left">
          {body}
        </button>
      )}
    </li>
  );
}
