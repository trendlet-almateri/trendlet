"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setDeliveryStatusAction } from "@/app/(app)/deliveries/actions";
import {
  enqueueMutation,
  flushQueue,
  listQueuedMutations,
  type QueuedMutation,
} from "@/lib/offline/queue";

type Status = QueuedMutation["status"];

type Props = {
  subOrderId: string;
  currentStatus: Status | string;
};

const NEXT_ACTIONS: Record<string, { label: string; status: Status; tone: "primary" | "danger" }[]> = {
  arrived_in_ksa: [
    { label: "Out for delivery", status: "out_for_delivery", tone: "primary" },
  ],
  out_for_delivery: [
    { label: "Mark delivered", status: "delivered", tone: "primary" },
    { label: "Returned", status: "returned", tone: "danger" },
  ],
  delivered: [],
  returned: [],
};

/**
 * Online: calls the server action; useOptimistic auto-rolls back on error.
 * Offline (or 5xx): queues in IndexedDB. `queuedStatus` (separate from the
 * optimistic transient) is the persistent IDB-backed state that survives
 * remounts and reflects across sessions until the next successful flush.
 */
export function DeliveryActions({ subOrderId, currentStatus }: Props) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  // Persistent queued status — survives remounts via IDB.
  const [queuedStatus, setQueuedStatus] = React.useState<Status | null>(null);

  // The base status the UI reflects: queued takes precedence over the
  // server-authoritative currentStatus while a mutation is parked.
  const baseStatus = queuedStatus ?? currentStatus;

  // Optimistic overlay for the in-flight transition. Auto-reverts to
  // baseStatus when the transition completes (success or error).
  const [optimisticStatus, setOptimisticStatus] = React.useOptimistic(
    baseStatus,
    (_current, next: Status) => next,
  );

  // On mount: hydrate the queued state from IDB if a prior session left
  // a mutation parked for this row.
  React.useEffect(() => {
    let cancelled = false;
    void listQueuedMutations().then((all) => {
      if (cancelled) return;
      const mine = all.find((m) => m.subOrderId === subOrderId);
      if (mine) setQueuedStatus(mine.status);
    });
    return () => {
      cancelled = true;
    };
  }, [subOrderId]);

  // Auto-flush on regaining connectivity or focus.
  React.useEffect(() => {
    async function tryFlush() {
      const flushed = await flushQueue(async (m) => setDeliveryStatusAction(m));
      if (flushed > 0) {
        setQueuedStatus(null);
        toast.success(`Synced ${flushed} pending update${flushed === 1 ? "" : "s"}.`);
        router.refresh();
      }
    }
    window.addEventListener("online", tryFlush);
    window.addEventListener("focus", tryFlush);
    return () => {
      window.removeEventListener("online", tryFlush);
      window.removeEventListener("focus", tryFlush);
    };
  }, [router]);

  const actions = NEXT_ACTIONS[optimisticStatus] ?? [];
  if (actions.length === 0) return null;

  function commit(target: Status) {
    startTransition(async () => {
      setOptimisticStatus(target);
      const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      if (!isOnline) {
        await enqueueMutation({ subOrderId, status: target, queuedAt: Date.now() });
        setQueuedStatus(target);
        toast.message("Saved offline — will sync when online.");
        return;
      }
      const res = await setDeliveryStatusAction({ subOrderId, status: target });
      if (!res.ok) {
        await enqueueMutation({ subOrderId, status: target, queuedAt: Date.now() });
        setQueuedStatus(target);
        toast.message("Saved offline — will sync when online.", {
          description: res.error ?? undefined,
        });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {actions.map((a) => (
        <button
          key={a.status}
          type="button"
          onClick={() => commit(a.status)}
          className={
            a.tone === "primary"
              ? "h-8 rounded-md bg-navy-deep px-3 text-[12px] font-medium text-white transition-colors hover:bg-navy disabled:opacity-50"
              : "h-8 rounded-md border border-status-danger-border bg-surface px-3 text-[12px] font-medium text-status-danger-fg transition-colors hover:bg-status-danger-bg disabled:opacity-50"
          }
        >
          {a.label}
        </button>
      ))}
      {queuedStatus && (
        <span
          className="ml-1 rounded-sm bg-status-pending-bg px-1.5 py-0.5 text-[10px] font-medium text-status-pending-fg"
          title="Saved offline. Will sync automatically."
        >
          Queued
        </span>
      )}
    </div>
  );
}
