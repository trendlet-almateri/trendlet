"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { syncHubstaffAction } from "./actions";

export function SyncHubstaffButton() {
  const [pending, startTransition] = React.useTransition();

  function handleSync() {
    startTransition(async () => {
      const res = await syncHubstaffAction();
      if (res.errors.length > 0) {
        toast.error(`Sync had ${res.errors.length} error${res.errors.length === 1 ? "" : "s"}`, {
          description: res.errors[0],
        });
        return;
      }
      const label = res.mode === "mock" ? "mock mode" : `${res.upserted}/${res.pulled} entries`;
      toast.success(`Hubstaff synced (${label})`);
    });
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={pending}
      className="flex h-9 items-center gap-2 rounded-md border border-hairline bg-surface px-3 text-[13px] font-medium text-ink-primary transition-colors hover:border-hairline-strong disabled:opacity-50"
    >
      <RefreshCw className={pending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden />
      {pending ? "Syncing…" : "Sync now"}
    </button>
  );
}
