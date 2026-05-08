"use client";

import { useState, useTransition } from "react";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Download,
  Webhook,
  RefreshCw,
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

type WebhookResult =
  | {
      ok: true;
      action: "created" | "already_registered";
      webhook: { id: string | number; topic: string; address: string };
    }
  | { ok: false; error: string };

const DEFAULT_SINCE = "2026-04-25";

export function ShopifySyncControls() {
  const [since, setSince] = useState(DEFAULT_SINCE);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const [webhookResult, setWebhookResult] = useState<WebhookResult | null>(null);
  const [pendingBackfill, startBackfill] = useTransition();
  const [pendingWebhook, startWebhook] = useTransition();

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

  function registerWebhook() {
    setWebhookResult(null);
    startWebhook(async () => {
      try {
        const res = await fetch("/api/admin/shopify-webhook-register", { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setWebhookResult({ ok: false, error: data.message || data.error || "Register failed" });
          return;
        }
        setWebhookResult({ ok: true, action: data.action, webhook: data.webhook });
      } catch (e) {
        setWebhookResult({ ok: false, error: e instanceof Error ? e.message : "Network error" });
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Backfill */}
      <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
        <h2 className="mb-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
          <Download className="h-3 w-3" aria-hidden /> Backfill orders
        </h2>
        <p className="mb-3 text-[12px] text-ink-secondary">
          Pull every order from Shopify since the date below. Existing
          orders get refreshed; missing ones get inserted.
        </p>

        <label className="mb-3 flex max-w-[260px] flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
            Since (UTC)
          </span>
          <Input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
        </label>

        <Button
          type="button"
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

      {/* Webhook register */}
      <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
        <h2 className="mb-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
          <Webhook className="h-3 w-3" aria-hidden /> Live webhook
        </h2>
        <p className="mb-3 text-[12px] text-ink-secondary">
          Register the <code className="mono">orders/create</code> webhook so
          Shopify pushes every new order to this app automatically. After
          this, you don&apos;t need to backfill again — orders sync live.
        </p>

        <Button
          type="button"
          onClick={registerWebhook}
          disabled={pendingWebhook}
          variant="secondary"
        >
          {pendingWebhook ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Registering…
            </>
          ) : (
            <>
              <Webhook className="h-4 w-4" aria-hidden /> Register webhook
            </>
          )}
        </Button>

        {webhookResult?.ok && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-status-success-border/40 bg-status-success-bg p-3 text-[12px] text-status-success-fg">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">
                Webhook {webhookResult.action === "created" ? "created" : "already registered"}
              </span>
              <span className="break-all text-[11px]">
                Topic: <code className="mono">{webhookResult.webhook.topic}</code>
              </span>
              <span className="break-all text-[11px]">
                URL: <code className="mono">{webhookResult.webhook.address}</code>
              </span>
              <span className="mt-1 text-[11px]">
                New orders will now flow live. Make sure{" "}
                <code className="mono">SHOPIFY_WEBHOOK_SECRET</code> matches
                Shopify&apos;s signing secret in your Custom App.
              </span>
            </div>
          </div>
        )}
        {webhookResult && !webhookResult.ok && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-status-danger-border/40 bg-status-danger-bg p-3 text-[12px] text-status-danger-fg">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
            <span className="break-all">{webhookResult.error}</span>
          </div>
        )}
      </section>
    </div>
  );
}
