import { requireAdmin } from "@/lib/auth/require-role";
import { createServiceClient } from "@/lib/supabase/server";
import { BootstrapForm } from "./bootstrap-form";
import { fullDateTime } from "@/lib/utils/date";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shopify token bootstrap · Trendslet Operations" };

type TokenRow = {
  shop: string;
  expires_at: string;
  refresh_token_expires_at: string;
  scope: string | null;
  updated_at: string;
};

export default async function ShopifyBootstrapPage() {
  await requireAdmin();
  const sb = createServiceClient();

  const { data: tokens } = await sb
    .from("shopify_tokens")
    .select("shop, expires_at, refresh_token_expires_at, scope, updated_at")
    .order("updated_at", { ascending: false });

  const rows = (tokens ?? []) as TokenRow[];

  return (
    <div className="flex flex-col gap-5">
      <header className="rise-in flex flex-col gap-1">
        <h1 className="text-h1 text-[var(--ink)]">Shopify token bootstrap</h1>
        <p className="max-w-[640px] text-[12px] text-[var(--muted)]">
          Exchange a non-expiring (or current) Shopify offline access token
          for an expiring access_token + refresh_token pair. After this runs,
          the app will auto-refresh tokens before expiry — no more manual
          token rotation. Re-run only if the refresh_token expires (90 days)
          or you need to rotate credentials.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <BootstrapForm />

        <aside className="flex flex-col gap-4">
          <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
            <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
              Tokens on file
            </h2>
            {rows.length === 0 ? (
              <p className="text-[12px] text-ink-tertiary">
                No tokens yet. Fill the form to bootstrap.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {rows.map((r) => {
                  const expSoon = new Date(r.expires_at).getTime() < Date.now() + 60 * 60 * 1000;
                  const refreshExpSoon = new Date(r.refresh_token_expires_at).getTime() < Date.now() + 7 * 24 * 60 * 60 * 1000;
                  return (
                    <li key={r.shop} className="flex flex-col gap-1 text-[12px]">
                      <span className="mono font-medium text-ink-primary">{r.shop}</span>
                      <span className={expSoon ? "text-status-danger-fg" : "text-ink-tertiary"}>
                        Access expires: {fullDateTime(r.expires_at)}
                      </span>
                      <span className={refreshExpSoon ? "text-status-danger-fg" : "text-ink-tertiary"}>
                        Refresh expires: {fullDateTime(r.refresh_token_expires_at)}
                      </span>
                      {r.scope && (
                        <span className="text-[11px] text-ink-tertiary">
                          Scope: {r.scope}
                        </span>
                      )}
                      <span className="text-[11px] text-ink-tertiary">
                        Updated: {fullDateTime(r.updated_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rise-in rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
            <h2 className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-tertiary">
              How this works
            </h2>
            <ol className="ml-4 flex list-decimal flex-col gap-1.5 text-[11px] text-ink-secondary">
              <li>You paste the current access token + app credentials.</li>
              <li>We call Shopify&apos;s token-exchange endpoint with <code className="mono">expiring=1</code>.</li>
              <li>Shopify returns a new access_token + refresh_token pair.</li>
              <li>We persist both to <code className="mono">shopify_tokens</code>.</li>
              <li>Backend reads <code className="mono">getValidToken(shop)</code> on every Shopify call — auto-refresh built in.</li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
