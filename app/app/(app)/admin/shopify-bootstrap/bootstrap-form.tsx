"use client";

import { useState, useTransition } from "react";
import { Loader2, AlertTriangle, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type BootstrapResult =
  | { ok: true; shop: string; expires_in: number; refresh_token_expires_in: number; scope: string | null }
  | { ok: false; error: string };

export function BootstrapForm() {
  const [shop, setShop] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [result, setResult] = useState<BootstrapResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/shopify/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop: shop.trim(),
            client_id: clientId.trim(),
            client_secret: clientSecret.trim(),
            current_access_token: accessToken.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setResult({ ok: false, error: data.message || data.error || "Bootstrap failed" });
          return;
        }
        setResult({
          ok: true,
          shop: data.shop,
          expires_in: data.expires_in,
          refresh_token_expires_in: data.refresh_token_expires_in,
          scope: data.scope,
        });
        // Don't auto-refresh — keep the form filled so admin sees what was sent.
      } catch (e) {
        setResult({ ok: false, error: e instanceof Error ? e.message : "Network error" });
      }
    });
  }

  return (
    <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
      <h2 className="mb-4 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
        <KeyRound className="h-3 w-3" aria-hidden /> Exchange token
      </h2>

      <div className="flex flex-col gap-3">
        <Field label="Shop domain" hint="e.g. trendlet.myshopify.com — without https://">
          <Input
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            placeholder="trendlet.myshopify.com"
            required
          />
        </Field>

        <Field label="Client ID (API key)" hint="From Shopify Custom App → API credentials">
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="abc123…"
            required
          />
        </Field>

        <Field label="Client secret" hint="From the same page — click Reveal">
          <Input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="shpss_…"
            required
          />
        </Field>

        <Field label="Current access token" hint="The shpat_… you've been using (will be replaced)">
          <Input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="shpat_…"
            required
          />
        </Field>

        <div className="mt-2 flex items-center gap-3">
          <Button
            type="button"
            onClick={submit}
            disabled={pending || !shop || !clientId || !clientSecret || !accessToken}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Exchanging…
              </>
            ) : (
              <>Exchange &amp; save</>
            )}
          </Button>
        </div>

        {result?.ok && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-status-success-border/40 bg-status-success-bg p-3 text-[12px] text-status-success-fg">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Bootstrap succeeded for {result.shop}</span>
              <span>Access expires in {Math.round(result.expires_in / 60)} min</span>
              <span>Refresh expires in {Math.round(result.refresh_token_expires_in / 86400)} days</span>
              {result.scope && <span className="text-[11px]">Scope: {result.scope}</span>}
              <span className="mt-1 text-[11px]">
                Auto-refresh is now active. The app will keep tokens fresh forever
                (until refresh_token expires in ~90 days).
              </span>
            </div>
          </div>
        )}

        {result && !result.ok && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-status-danger-border/40 bg-status-danger-bg p-3 text-[12px] text-status-danger-fg">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Bootstrap failed</span>
              <span className="break-all">{result.error}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] text-ink-tertiary">{hint}</span>}
    </label>
  );
}
