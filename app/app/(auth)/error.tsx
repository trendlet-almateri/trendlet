"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[auth error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-page">
      <div className="flex w-[380px] flex-col items-center gap-3 rounded-xl border border-hairline bg-surface p-10 text-center shadow-login">
        <AlertCircle className="h-5 w-5 text-status-danger-fg" aria-hidden />
        <p className="text-[14px] font-medium text-ink-primary">Sign-in unavailable</p>
        <p className="text-[12px] text-ink-secondary">
          The auth page failed to load. Try again, or contact your admin if this keeps happening.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-2 h-9 w-full rounded-md bg-navy-deep px-3 text-[13px] font-medium text-white transition-colors hover:bg-navy"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
