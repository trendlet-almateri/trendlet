/**
 * Phase 5: Zoho Mail INBOUND polling — pulls supplier emails from the
 * same mailbox Phase 3 sends from. Cron-driven; mock-mode-first when
 * Zoho env vars aren't set (returns an empty list, no errors).
 *
 * Reuses the access-token cache from zoho-mail.ts via local refresh.
 *
 * Zoho API used:
 *   GET  /accounts/{accountId}/messages/search   — list messages
 *   GET  /accounts/{accountId}/folders/{folderId}/messages/{messageId}  — message detail
 *   GET  /accounts/{accountId}/messages/{messageId}/attachments/{attachmentId}/info — attachment metadata
 *   GET  /accounts/{accountId}/messages/{messageId}/attachments/{attachmentId}     — attachment bytes
 *
 * Unread-only filter: we use search by `flag=unflagged&unread=true`
 * to pull only messages that haven't been touched yet, then mark them
 * read after successful ingestion (Phase 5b — for now we rely on the
 * dedup table only, leaving messages unread so a human can audit).
 */

import { apiCall, logSkipped } from "@/lib/api-client";

const TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const MAIL_BASE = "https://mail.zoho.com/api";

export type ZohoInboundMode = "live" | "mock";

export type InboundMessage = {
  message_id: string;
  from_address: string | null;
  subject: string | null;
  received_at: string | null; // ISO timestamp
  has_attachments: boolean;
};

export type InboundAttachment = {
  attachment_id: string;
  filename: string;
  content_type: string;
  bytes: Buffer;
};

export type ListInboundResult = {
  mode: ZohoInboundMode;
  messages: InboundMessage[];
  error: string | null;
};

export type FetchAttachmentsResult = {
  mode: ZohoInboundMode;
  attachments: InboundAttachment[];
  error: string | null;
};

export function isZohoInboundConfigured(): boolean {
  return Boolean(
    process.env.ZOHO_CLIENT_ID &&
      process.env.ZOHO_CLIENT_SECRET &&
      process.env.ZOHO_REFRESH_TOKEN &&
      process.env.ZOHO_ACCOUNT_ID,
  );
}

/* ── access token (separate cache from outbound to avoid coupling) ────── */

let cachedToken: { value: string; expires_at: number } | null = null;

async function getAccessToken(): Promise<
  { ok: true; token: string } | { ok: false; error: string }
> {
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

/* ── public: list new messages ───────────────────────────────────────── */

/**
 * Returns inbound messages received in the last `lookbackHours` window
 * that have at least one attachment. Defaults to 26h so a daily cron
 * has 2h of overlap protection.
 */
export async function listInboundMessages(
  opts: { lookbackHours?: number } = {},
): Promise<ListInboundResult> {
  if (!isZohoInboundConfigured()) {
    await logSkipped({
      service: "zoho",
      endpoint: "/messages/search",
      reason: "Zoho inbound env vars not configured (mock mode)",
    });
    return { mode: "mock", messages: [], error: null };
  }

  const tok = await getAccessToken();
  if (!tok.ok) {
    return { mode: "live", messages: [], error: `Zoho auth: ${tok.error}` };
  }

  const accountId = process.env.ZOHO_ACCOUNT_ID!;
  const lookbackHours = opts.lookbackHours ?? 26;
  const since = new Date(Date.now() - lookbackHours * 3600 * 1000)
    .toISOString();

  // Zoho's search API accepts `receivedTime` ranges and `attachedFile=true`
  // to limit to messages with attachments. We start at INBOX folder.
  const url = new URL(`${MAIL_BASE}/accounts/${accountId}/messages/search`);
  url.searchParams.set("searchKey", `attachedFile:true,receivedTime:gt:${since}`);
  url.searchParams.set("limit", "50");
  url.searchParams.set("sortBy", "date");
  url.searchParams.set("sortorder", "false");

  const res = await apiCall<{
    data?: Array<{
      messageId?: string;
      fromAddress?: string;
      subject?: string;
      receivedTime?: string;
      hasAttachment?: boolean | string;
    }>;
  }>({
    service: "zoho",
    endpoint: "/messages/search",
    method: "GET",
    url: url.toString(),
    headers: { Authorization: `Zoho-oauthtoken ${tok.token}` },
  });

  if (!res.ok) return { mode: "live", messages: [], error: res.error };

  const messages: InboundMessage[] = (res.data?.data ?? [])
    .filter((m) => m.messageId)
    .map((m) => ({
      message_id: String(m.messageId),
      from_address: m.fromAddress ?? null,
      subject: m.subject ?? null,
      received_at: parseZohoDate(m.receivedTime),
      has_attachments:
        m.hasAttachment === true ||
        m.hasAttachment === "true" ||
        m.hasAttachment === "1",
    }));

  return { mode: "live", messages, error: null };
}

/* ── public: fetch attachments for a message ─────────────────────────── */

export async function fetchMessageAttachments(input: {
  messageId: string;
}): Promise<FetchAttachmentsResult> {
  if (!isZohoInboundConfigured()) {
    return { mode: "mock", attachments: [], error: null };
  }

  const tok = await getAccessToken();
  if (!tok.ok) {
    return { mode: "live", attachments: [], error: `Zoho auth: ${tok.error}` };
  }

  const accountId = process.env.ZOHO_ACCOUNT_ID!;

  // Step 1: list attachment metadata for this message.
  const metaRes = await apiCall<{
    data?: Array<{
      attachmentId?: string;
      attachmentName?: string;
      contentType?: string;
    }>;
  }>({
    service: "zoho",
    endpoint: `/accounts/${accountId}/messages/${input.messageId}/attachmentinfo`,
    method: "GET",
    url: `${MAIL_BASE}/accounts/${accountId}/messages/${input.messageId}/attachmentinfo`,
    headers: { Authorization: `Zoho-oauthtoken ${tok.token}` },
  });

  if (!metaRes.ok) {
    return { mode: "live", attachments: [], error: metaRes.error };
  }

  const metas = (metaRes.data?.data ?? []).filter(
    (a) =>
      a.attachmentId &&
      (a.contentType === "application/pdf" ||
        (a.attachmentName ?? "").toLowerCase().endsWith(".pdf")),
  );

  // Step 2: download each PDF attachment. Zoho returns binary; we use
  // a direct fetch instead of apiCall because the latter assumes JSON.
  const out: InboundAttachment[] = [];
  for (const meta of metas) {
    const dlRes = await fetch(
      `${MAIL_BASE}/accounts/${accountId}/messages/${input.messageId}/attachment/${meta.attachmentId}`,
      {
        headers: { Authorization: `Zoho-oauthtoken ${tok.token}` },
      },
    );
    if (!dlRes.ok) {
      // Skip this attachment but keep going — partial success is fine.
      continue;
    }
    const buf = Buffer.from(await dlRes.arrayBuffer());
    if (buf.length === 0) continue;
    // Bonus magic-byte check (matches Phase 4e upload action).
    if (buf.length < 4 || buf[0] !== 0x25 || buf[1] !== 0x50 || buf[2] !== 0x44 || buf[3] !== 0x46) {
      continue;
    }
    out.push({
      attachment_id: String(meta.attachmentId),
      filename: meta.attachmentName ?? `attachment-${meta.attachmentId}.pdf`,
      content_type: meta.contentType ?? "application/pdf",
      bytes: buf,
    });
  }

  return { mode: "live", attachments: out, error: null };
}

function parseZohoDate(raw: string | undefined): string | null {
  if (!raw) return null;
  // Zoho returns either ISO-ish or epoch ms as string. Try both.
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && asNum > 0) {
    return new Date(asNum).toISOString();
  }
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
