"use client";

import { useState, useTransition } from "react";
import { Inbox, Loader2, Mail, AlertTriangle } from "lucide-react";
import { pollZohoInboundNowAction } from "./poll-now-action";

type RecentImport = {
  message_id: string;
  from_address: string | null;
  subject: string | null;
  attachment_count: number;
  status: string;
  processed_at: string;
};

export function InboundPollCard({
  isConfigured,
  recentImports,
}: {
  isConfigured: boolean;
  recentImports: RecentImport[];
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    mode: "live" | "mock";
    scanned: number;
    processed: number;
    created: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollNow = () => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await pollZohoInboundNowAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({
        mode: res.mode,
        scanned: res.messagesScanned,
        processed: res.messagesProcessed,
        created: res.invoicesCreated,
        errors: res.errors,
      });
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-hairline bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="flex items-center gap-2 text-[14px] font-medium text-ink-primary">
            <Mail className="h-4 w-4 text-ink-tertiary" aria-hidden />
            Zoho inbound polling
          </h2>
          <span className="text-[12px] text-ink-tertiary">
            Daily cron at 05:00 UTC pulls supplier-receipt PDFs from the Zoho
            mailbox.{" "}
            {isConfigured
              ? "Live mode."
              : "Mock mode — set ZOHO_* env vars to go live."}
          </span>
        </div>
        <button
          type="button"
          onClick={pollNow}
          disabled={pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#0f1419] px-3 text-[12px] font-medium text-white transition-colors hover:bg-[#1a2128] disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Inbox className="h-3.5 w-3.5" aria-hidden />
          )}
          Poll now
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-status-danger-border/40 bg-status-danger-bg/40 px-3 py-2 text-[12px] text-status-danger-fg">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="rounded-md border border-hairline bg-neutral-50 px-3 py-2 text-[12px] text-ink-secondary">
          <span className="font-medium text-ink-primary">
            {result.mode === "mock" ? "Mock run" : "Live run"}:
          </span>{" "}
          scanned {result.scanned}, processed {result.processed}, created{" "}
          {result.created} invoice{result.created === 1 ? "" : "s"}.
          {result.errors.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-status-danger-fg">
              {result.errors.slice(0, 5).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {recentImports.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.4px] text-ink-tertiary">
            Recent imports
          </span>
          <div className="flex flex-col divide-y divide-hairline rounded-md border border-hairline">
            {recentImports.map((imp) => (
              <div
                key={imp.message_id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-[12px]"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-ink-primary">
                    {imp.subject ?? "(no subject)"}
                  </span>
                  <span className="text-[11px] text-ink-tertiary">
                    {imp.from_address ?? "?"} ·{" "}
                    {new Date(imp.processed_at).toLocaleString("en-US")}
                  </span>
                </div>
                <span
                  className={
                    imp.status === "processed"
                      ? "text-status-delivered-fg"
                      : imp.status === "failed"
                      ? "text-status-danger-fg"
                      : "text-ink-tertiary"
                  }
                >
                  {imp.status}
                  {imp.attachment_count > 0
                    ? ` · ${imp.attachment_count} PDF${imp.attachment_count === 1 ? "" : "s"}`
                    : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
