"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { Bell, AlertCircle, AlertTriangle, Info, CheckCircle, X, ArrowUpRight } from "lucide-react";
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

type Toast = { id: string; notification: NotificationRow };

export function NotificationsPanel({ initialNotifications, userId, channelKey }: Props) {
  const router = useRouter();
  const [items, setItems] = React.useState<NotificationRow[]>(initialNotifications);
  const [open, setOpen] = React.useState(false);
  const [allOpen, setAllOpen] = React.useState(false);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const supabaseRef = React.useRef<ReturnType<typeof createClient> | null>(null);

  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  React.useEffect(() => {
    const channel = supabase
      .channel(`notifications-bell-${channelKey}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as NotificationRow;
          setItems((prev) => [row, ...prev].slice(0, 50));
          // Only show toasts from one instance (desktop) to avoid duplicates
          if (channelKey === "desktop" && row.severity === "critical") {
            const toastId = row.id;
            setToasts((prev) => [...prev, { id: toastId, notification: row }]);
            setTimeout(() => dismissToast(toastId), 8000);
          }
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, userId, channelKey, dismissToast]);

  const unreadCount = items.filter((n) => !n.read_at).length;
  // Bell popover shows the 30 most-recent; modal shows the full 30-day window.
  const bellItems = items.slice(0, 30);

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
    <>
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-md transition-colors",
            channelKey === "mobile"
              ? cn(
                  "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]",
                  open && "bg-[var(--hover)] text-[var(--ink)]",
                )
              : cn(
                  "text-[#6e7581] hover:bg-white/[0.06] hover:text-[#e2e4e8]",
                  open && "bg-white/[0.06] text-[#e2e4e8]",
                ),
          )}
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        >
          <Bell className="h-[18px] w-[18px]" aria-hidden />
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
          side="bottom"
          align="end"
          sideOffset={8}
          avoidCollisions
          collisionPadding={12}
          className={cn(
            "popover-dark z-50 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-xl",
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
            {bellItems.length === 0 ? (
              <div className="px-4 py-10 text-center text-[12px] text-[#6e7581]">
                You&apos;re all caught up.
              </div>
            ) : (
              <ul>
                {bellItems.map((n) => (
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
          <div className="border-t border-white/[0.06] px-4 py-2.5">
            <button
              type="button"
              onClick={() => { setOpen(false); setAllOpen(true); }}
              className="flex items-center gap-1 text-[11px] text-[#6e7581] transition-colors hover:text-white"
            >
              View all notifications
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>

      {/* All notifications modal */}
      {allOpen && typeof document !== "undefined" &&
        createPortal(
          <AllNotificationsModal
            items={items}
            unreadCount={unreadCount}
            onMarkAllRead={markAllRead}
            onMarkOneRead={markOneRead}
            onClose={() => setAllOpen(false)}
          />,
          document.body,
        )}

      {/* Critical toasts — rendered once (desktop only) */}
      {channelKey === "desktop" && toasts.length > 0 && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2">
            {toasts.map((t) => (
              <CriticalToast
                key={t.id}
                notification={t.notification}
                onDismiss={() => dismissToast(t.id)}
              />
            ))}
          </div>,
          document.body,
        )}
  </>
  );
}

// ── All notifications modal ───────────────────────────────────────────────────

function AllNotificationsModal({
  items,
  unreadCount,
  onMarkAllRead,
  onMarkOneRead,
  onClose,
}: {
  items: NotificationRow[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkOneRead: (id: string) => void;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        style={{ animation: "backdropIn 0.18s ease forwards" }}
        onClick={onClose}
      />

      {/* Card */}
      <div
        className="relative flex w-full max-w-[460px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#17191d] shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
        style={{ animation: "modalIn 0.22s cubic-bezier(0.16,1,0.3,1) forwards", maxHeight: "min(680px,85vh)" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Bell className="h-4 w-4 text-[#6e7581]" aria-hidden />
            <span className="text-[14px] font-semibold text-white">All Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-[var(--rose)] px-1.5 py-px text-[10px] font-semibold text-white tabular-nums">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onMarkAllRead}
              disabled={unreadCount === 0}
              className="text-[11px] text-[#6e7581] transition-colors hover:text-white disabled:opacity-40"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-7 w-7 place-items-center rounded-lg text-[#6e7581] transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-5 py-16 text-center text-[13px] text-[#6e7581]">
              You&apos;re all caught up — no notifications yet.
            </div>
          ) : (
            <ul>
              {items.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onActivate={() => {
                    if (!n.read_at) void onMarkOneRead(n.id);
                    onClose();
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <style>{`
        @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
}

// ── Critical toast ────────────────────────────────────────────────────────────

function CriticalToast({
  notification: n,
  onDismiss,
}: {
  notification: NotificationRow;
  onDismiss: () => void;
}) {
  const inner = (
    <div className="flex w-[min(360px,calc(100vw-40px))] items-start gap-3 rounded-xl border border-[var(--rose)]/30 bg-[#1a0f0f] px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
      style={{ animation: "toastIn 0.25s cubic-bezier(.32,.72,.32,1) forwards" }}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--rose)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-white">{n.title}</p>
        {n.description && (
          <p className="mt-0.5 line-clamp-1 text-[12px] text-[#9aa1aa]">{n.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-[#6e7581] hover:text-white"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return n.href ? (
    <Link href={n.href} onClick={onDismiss}>{inner}</Link>
  ) : (
    <div>{inner}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
