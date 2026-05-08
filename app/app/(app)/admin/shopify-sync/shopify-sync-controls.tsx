"use client";

import { useState, useTransition } from "react";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Download,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type BackfillResult =
  | {
      ok: true;
      since: string;
      fetched: number;
      inserted: number;
      refreshed: number;
      skipped: number;
      errors: { order_number: string; reason: string }[];
    }
  | { ok: false; error: string };

type PollResult =
  | {
      ok: true;
      since: string;
      last_polled_at: string;
      fetched: number;
      inserted: number;
      refreshed: number;
      skipped: number;
    }
  | { ok: false; error: string };

const DEFAULT_SINCE = "2026-04-25";

export function ShopifySyncControls() {
  const [since, setSince] = useState(DEFAULT_SINCE);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const [pollResult, setPollResult] = useState<PollResult | null>(null);
  const [pendingBackfill, startBackfill] = useTransition();
  const [pendingPoll, startPoll] = useTransition();

  function runBackfill() {
    setBackfillResult(null);
    startBackfill(async () => {
      try {
        const res = await fetch("/api/admin/shopify-backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ since_date: since, status: "any" }),
        });
        const data = await res.json();
        if (!res.ok) {
          setBackfillResult({ ok: false, error: data.message || data.error || "Backfill failed" });
          return;
        }
        setBackfillResult({ ok: true, ...data });
      } catch (e) {
        setBackfillResult({ ok: false, error: e instanceof Error ? e.message : "Network error" });
      }
    });
  }

  function forcePoll() {
    setPollResult(null);
    startPoll(async () => {
      try {
        const res = await fetch("/api/admin/shopify-poll-now", { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setPollResult({ ok: false, error: data.message || data.error || "Poll failed" });
          return;
        }
        setPollResult({ ok: true, ...data });
      } catch (e) {
        setPollResult({ ok: false, error: e instanceof Error ? e.message : "Network error" });
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Force poll now */}
      <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
        <h2 className="mb-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
          <Zap className="h-3 w-3" aria-hidden /> Force poll now
        </h2>
        <p className="mb-3 text-[12px] text-ink-secondary">
          Manually trigger the auto-sync job. Pulls any orders updated since
          the last successful poll. Useful for testing or grabbing the latest
          right now without waiting 5 minutes.
        </p>

        <Button type="button" onClick={forcePoll} disabled={pendingPoll}>
          {pendingPoll ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Polling…
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" aria-hidden /> Run sync now
            </>
          )}
        </Button>

        {pollResult?.ok && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-status-success-border/40 bg-status-success-bg p-3 text-[12px] text-status-success-fg">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Sync done</span>
              <span>
                Fetched <strong>{pollResult.fetched}</strong> · Inserted{" "}
                <strong>{pollResult.inserted}</strong> · Refreshed{" "}
                <strong>{pollResult.refreshed}</strong>
                {pollResult.skipped > 0 && (
                  <> · Skipped <strong>{pollResult.skipped}</strong></>
                )}
              </span>
            </div>
          </div>
        )}
        {pollResult && !pollResult.ok && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-status-danger-border/40 bg-status-danger-bg p-3 text-[12px] text-status-danger-fg">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
            <span className="break-all">{pollResult.error}</span>
          </div>
        )}
      </section>

      {/* Backfill */}
      <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
        <h2 className="mb-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
          <Download className="h-3 w-3" aria-hidden /> Backfill historical orders
        </h2>
        <p className="mb-3 text-[12px] text-ink-secondary">
          One-time grab of every order from Shopify since the date below. Use
          this for the initial catch-up. After that, the 5-min cron handles
          everything new automatically.
        </p>

        <label className="mb-3 flex max-w-[260px] flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
            Since (UTC)
          </span>
          <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
        </label>

        <Button
          type="button"
          variant="secondary"
          onClick={runBackfill}
          disabled={pendingBackfill || !since}
        >
          {pendingBackfill ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Backfilling…
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" aria-hidden /> Run backfill
            </>
          )}
        </Button>

        {backfillResult?.ok && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-status-success-border/40 bg-status-success-bg p-3 text-[12px] text-status-success-fg">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Backfill done — since {backfillResult.since}</span>
              <span>
                Fetched <strong>{backfillResult.fetched}</strong> · Inserted{" "}
                <strong>{backfillResult.inserted}</strong> · Refreshed{" "}
                <strong>{backfillResult.refreshed}</strong>
                {backfillResult.skipped > 0 && (
                  <> · Skipped <strong>{backfillResult.skipped}</strong></>
                )}
              </span>
              {backfillResult.errors.length > 0 && (
                <span className="text-[11px] text-amber-700">
                  {backfillResult.errors.length} error(s) — see browser console
                </span>
              )}
            </div>
          </div>
        )}
        {backfillResult && !backfillResult.ok && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-status-danger-border/40 bg-status-danger-bg p-3 text-[12px] text-status-danger-fg">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
            <span className="break-all">{backfillResult.error}</span>
          </div>
        )}
      </section>
    </div>
  );
}
