"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

export type ToastData = {
  id: string;
  message: string;
  sub?: string;
  kind: "info" | "success";
};

const DISMISS_MS = 3000; // visible time before exit starts
const EXIT_MS   = 400;   // slide-out duration (matches toastOut keyframe)

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer   = setTimeout(() => setExiting(true),    DISMISS_MS - EXIT_MS);
    const removeTimer = setTimeout(() => onDismiss(toast.id), DISMISS_MS);
    return () => { clearTimeout(exitTimer); clearTimeout(removeTimer); };
  }, [toast.id, onDismiss]);

  return (
    <div
      style={{
        animation: exiting
          ? `toastOut ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1) forwards`
          : "toastIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
      className="min-w-[220px] max-w-[300px] select-none rounded-xl border border-[var(--line)] bg-white px-4 py-3 shadow-[0_4px_24px_rgba(15,20,25,0.09),0_1px_4px_rgba(15,20,25,0.05)]"
    >
      {/* Main message — no icon, just bold text */}
      <p className="text-[13px] font-semibold leading-snug text-[var(--ink)]">
        {toast.message}
      </p>

      {/* Sub line — inline green check + muted text */}
      {toast.sub && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--green)]" aria-hidden />
          <p className="truncate text-[12px] text-[var(--muted)]">{toast.sub}</p>
        </div>
      )}
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
    <div className="fixed bottom-20 right-5 z-50 flex flex-col gap-2 md:bottom-6">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
