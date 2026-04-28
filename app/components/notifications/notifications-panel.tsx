"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/utils/date";
import type { NotificationRow } from "@/lib/queries/notifications";

type Props = {
  initialNotifications: NotificationRow[];
  userId: string;
  /** Unique per mounted instance to avoid Realtime channel name collisions. */
  channelKey: string;
};

const severityBorder: Record<NotificationRow["severity"], string> = {
  critical: "border-l-status-danger-border",
  warning: "border-l-status-sourcing-border",
  info: "border-l-status-warehouse-border",
  success: "border-l-status-success-border",
};

export function NotificationsPanel({ initialNotifications, userId, channelKey }: Props) {
  const router = useRouter();
  const [items, setItems] = React.useState<NotificationRow[]>(initialNotifications);
  const [open, setOpen] = React.useState(false);
  const supabaseRef = React.useRef<ReturnType<typeof createClient> | null>(null);

  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  // Realtime subscription: prepend new INSERTs for this user.
  React.useEffect(() => {
    const channel = supabase
      .channel(`notifications-bell-${channelKey}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          setItems((prev) => [row, ...prev].slice(0, 50));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
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
          className="relative flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-surface text-ink-secondary transition-colors hover:border-hairline-strong hover:text-ink-primary data-[state=open]:border-hairline-strong"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        >
          <Bell className="h-4 w-4" aria-hidden />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent"
            />
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className={cn(
            "z-50 w-[380px] overflow-hidden rounded-xl border border-hairline bg-surface shadow-popover",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          )}
        >
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <span className="text-[13px] font-medium text-ink-primary">Notifications</span>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-1 text-[11px] text-ink-tertiary transition-colors hover:text-ink-primary disabled:opacity-40 disabled:hover:text-ink-tertiary"
            >
              <Check className="h-3 w-3" aria-hidden />
              Mark all read
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-[12px] text-ink-tertiary">
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
  const body = (
    <div
      className={cn(
        "flex gap-3 border-l-2 px-4 py-3 transition-colors",
        severityBorder[n.severity],
        isUnread ? "bg-blue-50/40" : "bg-transparent",
        n.href && "hover:bg-neutral-50",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="flex-1 truncate text-[13px] font-medium text-ink-primary">
            {n.title}
          </span>
          {isUnread && (
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          )}
        </div>
        {n.description && (
          <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-secondary">{n.description}</p>
        )}
        <span className="mt-1 block text-[10px] text-ink-tertiary">
          {relativeTime(n.created_at)}
        </span>
      </div>
    </div>
  );

  return (
    <li className="border-b border-hairline last:border-b-0">
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
