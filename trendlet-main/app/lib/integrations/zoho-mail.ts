/**
 * Zoho Mail outbound integration — sends customer-facing invoice PDFs
 * from a single Trendslet mailbox (same one used for inbound supplier
 * receipts, polled separately in Phase 5).
 *
 * MOCK FALLBACK is the default until env vars are pasted:
 *   ZOHO_CLIENT_ID
 *   ZOHO_CLIENT_SECRET
 *   ZOHO_REFRESH_TOKEN
 *   ZOHO_ACCOUNT_ID         (numeric account id from Zoho Mail API)
 *   ZOHO_FROM_ADDRESS       (e.g. ops@trendlet.com — must be the mailbox owner)
 *
 * Flow when configured:
 *   1. Exchange refresh token for a short-lived access token (~1h TTL).
 *   2. POST /accounts/{accountId}/messages with the PDF attached as base64.
 *   3. Return { mode: "live", message_id, error: null } on success.
 *
 * The action layer treats `mode: "mock"` as a successful no-op (logs
 * "skipped" to api_logs, status flips to sent so admins can iterate the
 * UI before Zoho is live). Once env vars land, the same call path goes
 * live with zero code changes.
 */

import { apiCall, logSkipped } from "@/lib/api-client";

const TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const MAIL_BASE = "https://mail.zoho.com/api";

export type ZohoMode = "live" | "mock";

export type SendInvoiceEmailInput = {
  to: string;
  subject: string;
  /** Plain-text + minimal-HTML body. Customer-facing. */
  body: string;
  /** Customer invoice PDF buffer to attach. */
  pdf: Buffer;
  /** File name shown to the recipient (e.g. "INV-2026-000123.pdf"). */
  filename: string;
  user_id?: string | null;
};

export type SendInvoiceEmailResult = {
  mode: ZohoMode;
  message_id: string | null;
  error: string | null;
};

/**
 * True when all env vars needed for a live Zoho send are present. Used
 * by the UI to decide between "Mark sent" (mock) and "Send to customer"
 * (live) labeling, and by the action to log skipped vs live.
 */
export function isZohoConfigured(): boolean {
  return Boolean(
    process.env.ZOHO_CLIENT_ID &&
      process.env.ZOHO_CLIENT_SECRET &&
      process.env.ZOHO_REFRESH_TOKEN &&
      process.env.ZOHO_ACCOUNT_ID &&
      process.env.ZOHO_FROM_ADDRESS,
  );
}

/* ── access token cache ──────────────────────────────────────────────── */

let cachedToken: { value: string; expires_at: number } | null = null;

async function getAccessToken(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  // 60s safety margin so we don't ship a token about to expire.
  if (cachedToken && cachedToken.expires_at > Date.now() + 60_000) {
    return { ok: true, token: cachedToken.value };
  }

  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
    client_id: process.env.ZOHO_CLIENT_ID!,
    client_secret: process.env.ZOHO_CLIENT_SECRET!,
    grant_type: "refresh_token",
  });

  const res = await apiCall<{ access_token?: string; expires_in?: number; error?: string }>({
    service: "zoho",
    endpoint: "/oauth/v2/token",
    method: "POST",
    url: `${TOKEN_URL}?${params.toString()}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!res.ok || !res.data?.access_token) {
    return { ok: false, error: res.data?.error ?? res.error ?? "token exchange failed" };
  }

  cachedToken = {
    value: res.data.access_token,
    expires_at: Date.now() + (res.data.expires_in ?? 3600) * 1000,
  };
  return { ok: true, token: cachedToken.value };
}

/* ── public send ─────────────────────────────────────────────────────── */

export async function sendCustomerInvoiceEmail(
  input: SendInvoiceEmailInput,
): Promise<SendInvoiceEmailResult> {
  if (!isZohoConfigured()) {
    await logSkipped({
      service: "zoho",
      endpoint: "/messages",
      reason: "Zoho env vars not configured (mock mode)",
      user_id: input.user_id,
    });
    return { mode: "mock", message_id: null, error: null };
  }

  const tok = await getAccessToken();
  if (!tok.ok) {
    return { mode: "live", message_id: null, error: `Zoho auth: ${tok.error}` };
  }

  const accountId = process.env.ZOHO_ACCOUNT_ID!;
  const from = process.env.ZOHO_FROM_ADDRESS!;

  // Zoho Mail's send-message API takes the attachment inline as base64.
  // Body shape: https://www.zoho.com/mail/help/api/post-send-email.html
  const res = await apiCall<{ data?: { messageId?: string }; status?: { code?: number } }>({
    service: "zoho",
    endpoint: `/accounts/${accountId}/messages`,
    method: "POST",
    url: `${MAIL_BASE}/accounts/${accountId}/messages`,
    headers: {
      Authorization: `Zoho-oauthtoken ${tok.token}`,
      "Content-Type": "application/json",
    },
    body: {
      fromAddress: from,
      toAddress: input.to,
      subject: input.subject,
      content: input.body,
      mailFormat: "html",
      attachments: [
        {
          fileName: input.filename,
          content: input.pdf.toString("base64"),
          contentType: "application/pdf",
        },
      ],
    },
    user_id: input.user_id,
  });

  if (!res.ok) {
    return { mode: "live", message_id: null, error: res.error };
  }

  // Zoho returns either { data: { messageId } } or wraps in status. Both observed
  // in the wild — accept whichever is present.
  const messageId = res.data?.data?.messageId ?? null;
  return { mode: "live", message_id: messageId, error: null };
}
