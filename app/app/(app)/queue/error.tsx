"use client";

import * as React from "react";

export default function QueueError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[queue error]", error);
  }, [error]);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-6">
      <p className="text-[14px] font-semibold text-red-700">Queue page error</p>
      <pre className="overflow-auto rounded bg-white p-3 text-[11px] text-red-900">
        {error?.message ?? "no message"}
        {"\n"}
        {error?.stack ?? "no stack"}
      </pre>
      {error.digest && (
        <p className="text-[11px] text-red-500">digest: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="w-fit rounded bg-red-600 px-3 py-1.5 text-[12px] text-white hover:bg-red-700"
      >
        Try again
      </button>
    </div>
  );
}
