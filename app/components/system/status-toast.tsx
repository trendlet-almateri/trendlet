"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

// ── Shared action-feedback toast ──────────────────────────────────────────────
// Used by SourcingGrid, WarehouseGrid, EuGrid after a sub-order status change.
// Each toast lives for 2 s then slides down and is removed.

export type ToastData = {
  id: string;
  message: string;
  sub?: string;
  kind: "info" | "success";
};

const DISMISS_MS = 2000;   // total visible time
const EXIT_MS   = 350;     // slide-out duration (must match toastOut keyframe)

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer   = setTimeout(() => setExiting(true),           DISMISS_MS - EXIT_MS);
    const removeTimer = setTimeout(() => onDismiss(toast.id),        DISMISS_MS);
    return () => { clearTimeout(exitTimer); clearTimeout(removeTimer); };
  }, [toast.id, onDismiss]);

  return (
    <div
      style={{
        animation: exiting
          ? `toastOut ${EXIT_MS}ms cubic-bezier(.32,.72,.32,1) forwards`
          : "toastIn 0.25s cubic-bezier(.32,.72,.32,1) forwards",
      }}
      className="flex min-w-[240px] max-w-[320px] items-start gap-2.5 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 shadow-[var(--shadow-md)]"
    >
      <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-[var(--green)]" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold leading-snug text-[var(--ink)]">
          {toast.message}
        </p>
        {toast.sub && (
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)] truncate">
            {toast.sub}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="mt-0.5 shrink-0 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function StatusToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    // bottom-20 on mobile (above bottom-nav), bottom-6 on desktop
    <div className="fixed bottom-20 right-5 z-50 flex flex-col gap-2 md:bottom-6">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
