"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

/**
 * Catches runtime errors thrown anywhere in the (app) route group.
 * `reset()` re-renders the segment without a full reload — the typical fix
 * for transient Supabase / fetch failures.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-hairline bg-surface px-6 py-16 text-center">
      <AlertCircle className="h-5 w-5 text-status-danger-fg" aria-hidden />
      <p className="text-[13px] font-medium text-ink-primary">Something went wrong</p>
      <p className="max-w-md text-[12px] text-ink-secondary">
        The page hit an unexpected error. Try again, or go back and reopen it.
      </p>
      {error.digest && (
        <p className="text-[10px] uppercase tracking-[0.4px] text-ink-tertiary">
          Reference: {error.digest}
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-2 h-8 rounded-md bg-navy-deep px-3 text-[12px] font-medium text-white transition-colors hover:bg-navy"
      >
        Try again
      </button>
    </div>
  );
}
