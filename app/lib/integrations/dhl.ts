/**
 * DHL Express (MyDHL API) integration.
 *
 * Auth: HTTP Basic — base64(DHL_API_USERNAME:DHL_API_PASSWORD).
 * Base URL: DHL_API_BASE (sandbox = https://express.api.dhl.com/mydhlapi/test,
 * prod = https://express.api.dhl.com/mydhlapi). Sandbox-only until cutover.
 *
 * MOCK FALLBACK: if credentials are absent, createDhlLabel returns a
 * "MOCK-<8 hex>" tracking number so downstream code (shipments table,
 * /shipments page) still works without touching DHL.
 *
 * Phase 1 = auth proof only: dhlRateCheck() hits the NON-creating /rates
 * endpoint to verify credentials. createDhlLabel keeps the previous
 * (placeholder) payload — a real MyDHL shipment body lands in Phase 2.
 */

import { apiCall, logSkipped } from "@/lib/api-client";

/** Returns null when DHL is not configured (mock mode). */
function dhlCreds(): { authHeader: string; baseUrl: string } | null {
  const username = process.env.DHL_API_USERNAME;
  const password = process.env.DHL_API_PASSWORD;
  const baseUrl = process.env.DHL_API_BASE;
  if (!username || !password || !baseUrl) return null;
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  return { authHeader, baseUrl: baseUrl.replace(/\/$/, "") };
}

// ── Phase 1: auth proof (NON-creating) ───────────────────────────────────────

export type RateCheckResult = {
  mode: "live" | "skipped";
  ok: boolean;
  http_status: number;
  /** Number of rate products DHL returned (sanity signal). */
  products: number;
  error: string | null;
};

/**
 * Calls MyDHL `POST /rates` — a price quote. Creates NOTHING; it only proves
 * the credentials + base URL are valid. Used by the Phase-1 diagnostic.
 */
export async function dhlRateCheck(): Promise<RateCheckResult> {
  const creds = dhlCreds();
  if (!creds) {
    await logSkipped({
      service: "dhl",
      endpoint: "/rates",
      reason: "DHL_API_USERNAME/PASSWORD/BASE not configured",
    });
    return { mode: "skipped", ok: false, http_status: 0, products: 0, error: "DHL not configured" };
  }

  // Minimal, well-formed rate request. Static sample values — no DB data,
  // no shipment created. Planned date = 2 days out (DHL rejects past dates).
  const plannedDate = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);

  const res = await apiCall<{ products?: unknown[] }>({
    service: "dhl",
    endpoint: "/rates",
    method: "POST",
    url: `${creds.baseUrl}/rates`,
    headers: {
      Authorization: creds.authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: {
      customerDetails: {
        shipperDetails: { postalCode: "07114", cityName: "Newark", countryCode: "US" },
        receiverDetails: { postalCode: "11564", cityName: "Riyadh", countryCode: "SA" },
      },
      plannedShippingDateAndTime: `${plannedDate}T10:00:00GMT+00:00`,
      unitOfMeasurement: "metric",
      isCustomsDeclarable: true,
      packages: [{ weight: 1, dimensions: { length: 10, width: 10, height: 10 } }],
    },
  });

  return {
    mode: "live",
    ok: res.ok,
    http_status: res.status,
    products: Array.isArray(res.data?.products) ? res.data!.products!.length : 0,
    error: res.error,
  };
}

// ── Shipment label creation (auth/env fixed; real payload = Phase 2) ─────────

export type CreateLabelInput = {
  origin: string; // e.g. "US-NJ"
  destination: string; // e.g. "SA-RUH"
  weight_kg: number;
  pieces: number;
};

export type CreateLabelResult = {
  mode: "live" | "mock";
  tracking_number: string;
  label_url: string | null;
  error: string | null;
};

export async function createDhlLabel(input: CreateLabelInput): Promise<CreateLabelResult> {
  const creds = dhlCreds();

  if (!creds) {
    await logSkipped({
      service: "dhl",
      endpoint: "/shipments",
      reason: "DHL_API_USERNAME/PASSWORD/BASE not configured (mock mode)",
    });
    return {
      mode: "mock",
      tracking_number: `MOCK-${randomHex(8).toUpperCase()}`,
      label_url: null,
      error: null,
    };
  }

  const res = await apiCall<{ shipmentTrackingNumber?: string; documents?: { url: string }[] }>({
    service: "dhl",
    endpoint: "/shipments",
    method: "POST",
    url: `${creds.baseUrl}/shipments`,
    headers: {
      Authorization: creds.authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: {
      productCode: "P", // Express Worldwide
      pickup: { isRequested: false },
      shipper: { addressLocation: input.origin },
      receiver: { addressLocation: input.destination },
      content: {
        packages: [{ weight: input.weight_kg }],
        unitOfMeasurement: "metric",
        isCustomsDeclarable: true,
      },
    },
  });

  if (!res.ok || !res.data?.shipmentTrackingNumber) {
    return {
      mode: "live",
      tracking_number: "",
      label_url: null,
      error: res.error ?? "DHL did not return a tracking number",
    };
  }

  return {
    mode: "live",
    tracking_number: res.data.shipmentTrackingNumber,
    label_url: res.data.documents?.[0]?.url ?? null,
    error: null,
  };
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
