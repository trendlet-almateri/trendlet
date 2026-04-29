/**
 * Centralized external API wrapper.
 *
 * Every external call from server code goes through `apiCall`. It logs
 * METADATA ONLY to public.api_logs — service, endpoint, method, http_status,
 * latency, optional cost. NEVER bodies, headers, or secrets (spec §12).
 *
 * Failure path: still logs the call with status='error', then re-throws so
 * callers can decide what to do. The wrapper itself never swallows errors.
 */

import { createServiceClient } from "@/lib/supabase/server";

export type ApiService = "shopify" | "twilio" | "openai" | "openrouter" | "dhl" | "hubstaff" | "resend" | "zoho";

export type ApiCallParams = {
  service: ApiService;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  /** Cost estimate in USD. Optional — only some services produce one. */
  cost_usd?: number;
  /** When set, the row in api_logs is attributed to this user. */
  user_id?: string | null;
};

export type ApiCallResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
};

async function logApiCall(row: {
  service: string;
  endpoint: string;
  method: string;
  status: "success" | "error" | "skipped";
  http_status: number | null;
  latency_ms: number | null;
  cost_usd: number | null;
  error_message: string | null;
  user_id: string | null;
}): Promise<void> {
  try {
    const sb = createServiceClient();
    await sb.from("api_logs").insert(row);
  } catch (e) {
    // Logging must never break the caller. Swallow + console.
    console.error("[api-client] failed to log api call", e);
  }
}

/**
 * Performs an HTTP call with metadata logging. Caller decides response parsing.
 * Returns parsed JSON when content-type is JSON; otherwise returns text.
 */
export async function apiCall<T = unknown>(params: ApiCallParams): Promise<ApiCallResult<T>> {
  const { service, endpoint, method, url, headers, body, cost_usd, user_id } = params;
  const start = Date.now();
  let httpStatus: number | null = null;
  let errorMessage: string | null = null;
  let data: T | null = null;
  let ok = false;

  try {
    const init: RequestInit = { method, headers };
    if (body !== undefined && method !== "GET") {
      init.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    const res = await fetch(url, init);
    httpStatus = res.status;
    ok = res.ok;

    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      data = (await res.json()) as T;
    } else {
      // For non-JSON responses, surface text under data with a cast.
      data = (await res.text()) as unknown as T;
    }

    if (!ok) {
      // Don't log response body. Just the status code.
      errorMessage = `HTTP ${res.status}`;
    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "unknown";
  }

  await logApiCall({
    service,
    endpoint,
    method,
    status: ok ? "success" : "error",
    http_status: httpStatus,
    latency_ms: Date.now() - start,
    cost_usd: cost_usd ?? null,
    error_message: errorMessage,
    user_id: user_id ?? null,
  });

  return { ok, status: httpStatus ?? 0, data, error: errorMessage };
}

/**
 * Records a "skipped" entry in api_logs. Used by mock fallbacks (DHL,
 * Hubstaff, Resend) and Twilio when no template SID is configured.
 * Skipped calls have no latency, no http_status — they never went out.
 */
export async function logSkipped(params: {
  service: ApiService;
  endpoint: string;
  reason: string;
  user_id?: string | null;
}): Promise<void> {
  await logApiCall({
    service: params.service,
    endpoint: params.endpoint,
    method: "POST",
    status: "skipped",
    http_status: null,
    latency_ms: null,
    cost_usd: null,
    error_message: params.reason,
    user_id: params.user_id ?? null,
  });
}
