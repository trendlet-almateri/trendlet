/**
 * Shared core for the read-only AI Support data-access layer
 * (`/api/support/*`).
 *
 * This is the controlled abstraction over Supabase for the future AI
 * Support app. The AI calls these HTTP endpoints with a static Bearer
 * token — it NEVER touches Supabase and NEVER constructs SQL. Every
 * endpoint is strictly read-only (SELECT via the service-role client,
 * which is server-only).
 *
 * Responsibilities centralised here:
 *  - auth: validate Authorization: Bearer <INTERNAL_AI_TOKEN>
 *  - input validation (zod)
 *  - normalization: map DB rows -> safe DTOs (no UUIDs, employee names,
 *    admin notes, internal shipment IDs, service tokens)
 *  - uniform JSON error envelope
 *  - request logging to api_logs (metadata only — no PII bodies)
 */

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

// ── Error codes ──────────────────────────────────────────────────────────────
export type SupportErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "ORDER_NOT_FOUND"
  | "AMBIGUOUS_MATCH"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR";

type ErrorEnvelope = {
  found: false;
  error: { code: SupportErrorCode; message: string };
};

/** Build a uniform error JSON response. `not found` cases use HTTP 200 so
 *  the AI handles them gracefully; auth/validation use 4xx. */
export function supportError(
  code: SupportErrorCode,
  message: string,
): NextResponse {
  const httpStatus =
    code === "UNAUTHORIZED"
      ? 401
      : code === "INVALID_INPUT"
        ? 400
        : code === "RATE_LIMITED"
          ? 429
          : code === "UPSTREAM_ERROR"
            ? 502
            : 200; // ORDER_NOT_FOUND, AMBIGUOUS_MATCH
  const body: ErrorEnvelope = { found: false, error: { code, message } };
  return NextResponse.json(body, { status: httpStatus });
}

// ── Auth ─────────────────────────────────────────────────────────────────────
/**
 * Validate the static internal Bearer token. Constant-time compare to
 * avoid timing attacks. Returns null on success, or a 401 response.
 */
export function checkAuth(req: Request): NextResponse | null {
  const expected = process.env.INTERNAL_AI_TOKEN;
  if (!expected) {
    // Fail closed: misconfiguration must never mean "open".
    return supportError(
      "UNAUTHORIZED",
      "Support API is not configured for access.",
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) {
    return supportError("UNAUTHORIZED", "Missing or malformed Authorization header.");
  }
  const provided = header.slice(prefix.length);

  // timingSafeEqual requires equal-length buffers; length check first
  // (length itself is not secret).
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return supportError("UNAUTHORIZED", "Invalid access token.");
  }
  return null;
}

// ── Logging ──────────────────────────────────────────────────────────────────
/**
 * Log one support API call to api_logs. Metadata only — never request
 * bodies, customer PII, or tokens. Email queries are hashed, not stored.
 * Logging must never break the response (errors swallowed).
 */
export async function logSupportCall(params: {
  endpoint: string;
  ok: boolean;
  httpStatus: number;
  latencyMs: number;
  errorMessage?: string | null;
}): Promise<void> {
  try {
    const sb = createServiceClient();
    await sb.from("api_logs").insert({
      service: "support_ai",
      endpoint: params.endpoint,
      method: "GET",
      status: params.ok ? "success" : "error",
      http_status: params.httpStatus,
      latency_ms: params.latencyMs,
      cost_usd: null,
      error_message: params.errorMessage ?? null,
      user_id: null, // support endpoints have no authenticated user
    });
  } catch (e) {
    console.error("[support] failed to log api call", e);
  }
}

/**
 * Wrap an endpoint handler with auth + timing + logging + a safety net.
 * The handler returns a NextResponse; this adds the cross-cutting concerns
 * so each route stays focused on its query + normalization.
 */
export async function withSupport(
  req: Request,
  endpoint: string,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const start = Date.now();

  const authFail = checkAuth(req);
  if (authFail) {
    await logSupportCall({
      endpoint,
      ok: false,
      httpStatus: 401,
      latencyMs: Date.now() - start,
      errorMessage: "unauthorized",
    });
    return authFail;
  }

  try {
    const res = await handler();
    await logSupportCall({
      endpoint,
      ok: res.status < 400,
      httpStatus: res.status,
      latencyMs: Date.now() - start,
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await logSupportCall({
      endpoint,
      ok: false,
      httpStatus: 502,
      latencyMs: Date.now() - start,
      errorMessage: msg,
    });
    return supportError(
      "UPSTREAM_ERROR",
      "Could not retrieve order data right now. Please try again shortly.",
    );
  }
}
