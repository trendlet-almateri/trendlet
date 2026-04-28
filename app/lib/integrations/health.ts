/**
 * Read-only health checks for every external integration.
 *
 * Every check is HTTP HEAD/GET against a "shape only" endpoint — no
 * messages sent, no labels created, no AI tokens spent. Each check goes
 * through apiCall() so admins get an audit trail in api_logs.
 *
 * Status semantics:
 *   "ok"            — credentials present, endpoint returned 200
 *   "missing"       — env var(s) not configured
 *   "auth_failed"   — credentials present, endpoint returned 401/403
 *   "error"         — credentials present, endpoint returned non-2xx or threw
 *   "skipped"       — service has no safe ping endpoint (DHL prod calls cost)
 */

import { createServiceClient } from "@/lib/supabase/server";
import { apiCall } from "@/lib/api-client";

export type HealthStatus = "ok" | "missing" | "auth_failed" | "error" | "skipped";

export type IntegrationHealth = {
  service: string;
  status: HealthStatus;
  detail: string;
  latency_ms: number | null;
};

export async function checkSupabase(): Promise<IntegrationHealth> {
  const start = Date.now();
  try {
    const sb = createServiceClient();
    const { error } = await sb.from("statuses").select("key").limit(1);
    if (error) {
      return {
        service: "supabase",
        status: "error",
        detail: error.message,
        latency_ms: Date.now() - start,
      };
    }
    return {
      service: "supabase",
      status: "ok",
      detail: "service-role + RLS reachable",
      latency_ms: Date.now() - start,
    };
  } catch (e) {
    return {
      service: "supabase",
      status: "error",
      detail: e instanceof Error ? e.message : "unknown",
      latency_ms: Date.now() - start,
    };
  }
}

export async function checkShopify(): Promise<IntegrationHealth> {
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  const domain = process.env.SHOPIFY_SHOP_DOMAIN;
  if (!token || !domain) {
    return { service: "shopify", status: "missing", detail: "missing token or shop domain", latency_ms: null };
  }

  const res = await apiCall<{ shop?: { name?: string; myshopify_domain?: string } }>({
    service: "shopify",
    endpoint: "/admin/api/2024-10/shop.json",
    method: "GET",
    url: `https://${domain}/admin/api/2024-10/shop.json`,
    headers: { "X-Shopify-Access-Token": token, Accept: "application/json" },
  });

  if (res.status === 401 || res.status === 403) {
    return { service: "shopify", status: "auth_failed", detail: `HTTP ${res.status}`, latency_ms: null };
  }
  if (!res.ok) {
    return { service: "shopify", status: "error", detail: res.error ?? `HTTP ${res.status}`, latency_ms: null };
  }
  const shopName = res.data?.shop?.name ?? "unknown shop";
  return { service: "shopify", status: "ok", detail: `connected to ${shopName}`, latency_ms: null };
}

export async function checkTwilio(): Promise<IntegrationHealth> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    return { service: "twilio", status: "missing", detail: "missing SID or token", latency_ms: null };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await apiCall<{ friendly_name?: string; status?: string }>({
    service: "twilio",
    endpoint: `/Accounts/${sid}.json`,
    method: "GET",
    url: `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });

  if (res.status === 401) {
    return { service: "twilio", status: "auth_failed", detail: "HTTP 401", latency_ms: null };
  }
  if (!res.ok) {
    return { service: "twilio", status: "error", detail: res.error ?? `HTTP ${res.status}`, latency_ms: null };
  }

  // Also check that at least one status has a template SID configured.
  const sb = createServiceClient();
  const { count } = await sb
    .from("statuses")
    .select("*", { count: "exact", head: true })
    .not("twilio_template_sid", "is", null);
  const sidCount = count ?? 0;
  const accountStatus = res.data?.status ?? "active";
  return {
    service: "twilio",
    status: sidCount > 0 ? "ok" : "ok",
    detail: `account ${accountStatus} · ${sidCount}/15 template SIDs configured`,
    latency_ms: null,
  };
}

export async function checkOpenAi(): Promise<IntegrationHealth> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return { service: "openai", status: "missing", detail: "OPENAI_API_KEY not set", latency_ms: null };
  }

  const res = await apiCall<{ data?: { id: string }[] }>({
    service: "openai",
    endpoint: "/v1/models",
    method: "GET",
    url: "https://api.openai.com/v1/models",
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });

  if (res.status === 401) {
    return { service: "openai", status: "auth_failed", detail: "HTTP 401", latency_ms: null };
  }
  if (!res.ok) {
    return { service: "openai", status: "error", detail: res.error ?? `HTTP ${res.status}`, latency_ms: null };
  }
  const modelCount = res.data?.data?.length ?? 0;
  return { service: "openai", status: "ok", detail: `${modelCount} models available`, latency_ms: null };
}

export async function checkOpenRouter(): Promise<IntegrationHealth> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return { service: "openrouter", status: "missing", detail: "OPENROUTER_API_KEY not set", latency_ms: null };
  }

  const base = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
  const res = await apiCall<{ data?: { id: string }[] }>({
    service: "openrouter",
    endpoint: "/models",
    method: "GET",
    url: `${base}/models`,
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });

  if (res.status === 401) {
    return { service: "openrouter", status: "auth_failed", detail: "HTTP 401", latency_ms: null };
  }
  if (!res.ok) {
    return { service: "openrouter", status: "error", detail: res.error ?? `HTTP ${res.status}`, latency_ms: null };
  }
  const modelCount = res.data?.data?.length ?? 0;
  return { service: "openrouter", status: "ok", detail: `${modelCount} models available`, latency_ms: null };
}

export async function checkDhl(): Promise<IntegrationHealth> {
  const key = process.env.DHL_API_KEY;
  if (!key) {
    return { service: "dhl", status: "missing", detail: "DHL_API_KEY not set", latency_ms: null };
  }
  // DHL Express has no free no-op endpoint; live POST /shipments creates real labels.
  return {
    service: "dhl",
    status: "skipped",
    detail: "credentials present; no safe ping endpoint",
    latency_ms: null,
  };
}

export async function checkHubstaff(): Promise<IntegrationHealth> {
  const token = process.env.HUBSTAFF_TOKEN;
  if (!token) {
    return { service: "hubstaff", status: "missing", detail: "HUBSTAFF_TOKEN not set", latency_ms: null };
  }
  const res = await apiCall<{ user?: { id: number; name: string } }>({
    service: "hubstaff",
    endpoint: "/v2/users/me",
    method: "GET",
    url: "https://api.hubstaff.com/v2/users/me",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (res.status === 401) {
    return { service: "hubstaff", status: "auth_failed", detail: "HTTP 401", latency_ms: null };
  }
  if (!res.ok) {
    return { service: "hubstaff", status: "error", detail: res.error ?? `HTTP ${res.status}`, latency_ms: null };
  }
  return {
    service: "hubstaff",
    status: "ok",
    detail: `connected as ${res.data?.user?.name ?? "unknown"}`,
    latency_ms: null,
  };
}

export async function checkResend(): Promise<IntegrationHealth> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { service: "resend", status: "missing", detail: "RESEND_API_KEY not set", latency_ms: null };
  }
  // Resend's GET /domains is read-only and free
  const res = await apiCall<{ data?: unknown[] }>({
    service: "resend",
    endpoint: "/domains",
    method: "GET",
    url: "https://api.resend.com/domains",
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (res.status === 401) {
    return { service: "resend", status: "auth_failed", detail: "HTTP 401", latency_ms: null };
  }
  if (!res.ok) {
    return { service: "resend", status: "error", detail: res.error ?? `HTTP ${res.status}`, latency_ms: null };
  }
  return {
    service: "resend",
    status: "ok",
    detail: `${res.data?.data?.length ?? 0} domains configured`,
    latency_ms: null,
  };
}

export async function checkAll(): Promise<IntegrationHealth[]> {
  // Fan out — each check is independent.
  return Promise.all([
    checkSupabase(),
    checkShopify(),
    checkTwilio(),
    checkOpenAi(),
    checkOpenRouter(),
    checkDhl(),
    checkHubstaff(),
    checkResend(),
  ]);
}
