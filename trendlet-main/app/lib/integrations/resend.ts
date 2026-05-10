/**
 * Resend email integration — invitation emails + invoice delivery.
 *
 * MOCK FALLBACK is the default — RESEND_API_KEY is not set. Mock logs
 * "skipped: RESEND_API_KEY not configured" to api_logs and returns ok
 * so the caller can proceed (the email simply doesn't go out).
 */

import { apiCall, logSkipped } from "@/lib/api-client";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  /** Optional override; defaults to a Trendslet from-address. */
  from?: string;
};

export type SendEmailResult = {
  mode: "live" | "mock";
  message_id: string | null;
  error: string | null;
};

const DEFAULT_FROM = "Trendslet Operations <ops@trendlet.com>";

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    await logSkipped({
      service: "resend",
      endpoint: "/emails",
      reason: "RESEND_API_KEY not configured (mock mode)",
    });
    return { mode: "mock", message_id: null, error: null };
  }

  const res = await apiCall<{ id?: string }>({
    service: "resend",
    endpoint: "/emails",
    method: "POST",
    url: "https://api.resend.com/emails",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: {
      from: input.from ?? DEFAULT_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
    },
  });

  if (!res.ok) {
    return { mode: "live", message_id: null, error: res.error };
  }
  return { mode: "live", message_id: res.data?.id ?? null, error: null };
}
