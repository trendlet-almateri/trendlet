/**
 * DHL Express integration — bulk shipment label creation.
 *
 * MOCK FALLBACK is the default — DHL_API_KEY is not set. Mock returns a
 * deterministic-looking tracking number ("MOCK-<8 hex>") so downstream
 * code (shipments table, /shipments page) can be exercised without
 * touching the real DHL endpoint.
 */

import { apiCall, logSkipped } from "@/lib/api-client";

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
  const apiKey = process.env.DHL_API_KEY;
  const baseUrl = process.env.DHL_BASE_URL ?? "https://express.api.dhl.com/mydhlapi";

  if (!apiKey) {
    await logSkipped({
      service: "dhl",
      endpoint: "/shipments",
      reason: "DHL_API_KEY not configured (mock mode)",
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
    url: `${baseUrl}/shipments`,
    headers: {
      Authorization: `Basic ${apiKey}`,
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

/**
 * DHL Shipment Tracking — Unified (Pull) API. Read-only status lookup
 * BY tracking number. Auth = `DHL-API-Key` header, KEY ONLY (the API
 * secret is unused for this API). Production EU endpoint.
 *
 * This is a different DHL product from createDhlLabel above (MyDHL
 * Express label creation). Verified working 2026-05-19 against a real
 * Express shipment.
 */
export type TrackEvent = {
  timestamp: string;
  description: string;
  status_code: string | null;
  location: string | null;
};

export type TrackResult = {
  found: boolean;
  tracking_number: string;
  service: string | null;
  origin: string | null;
  destination: string | null;
  status_code: string | null; // pre-transit | transit | delivered | failure | unknown
  status: string | null;
  description: string | null;
  last_update: string | null;
  estimated_delivery: string | null;
  pieces: number | null;
  events: TrackEvent[];
  error: string | null;
};

type DhlAddress = { addressLocality?: string };
type DhlEvent = {
  timestamp?: string;
  description?: string;
  statusCode?: string;
  location?: { address?: DhlAddress };
};
type DhlShipment = {
  id?: string;
  service?: string;
  origin?: { address?: DhlAddress };
  destination?: { address?: DhlAddress };
  status?: { statusCode?: string; status?: string; description?: string; timestamp?: string };
  estimatedTimeOfDelivery?: string;
  details?: { totalNumberOfPieces?: number };
  events?: DhlEvent[];
};

export async function trackDhlShipment(trackingNumber: string): Promise<TrackResult> {
  const empty: TrackResult = {
    found: false,
    tracking_number: trackingNumber,
    service: null,
    origin: null,
    destination: null,
    status_code: null,
    status: null,
    description: null,
    last_update: null,
    estimated_delivery: null,
    pieces: null,
    events: [],
    error: null,
  };

  // Vercel env var is named DHL_API_Key (mixed case) — must match exactly.
  const apiKey = process.env.DHL_API_Key;
  if (!apiKey) {
    return { ...empty, error: "DHL_API_Key not configured" };
  }

  const base = process.env.DHL_TRACKING_BASE ?? "https://api-eu.dhl.com/track/shipments";
  const res = await apiCall<{ shipments?: DhlShipment[] }>({
    service: "dhl",
    endpoint: "/track/shipments",
    method: "GET",
    url: `${base}?trackingNumber=${encodeURIComponent(trackingNumber)}`,
    headers: { "DHL-API-Key": apiKey, Accept: "application/json" },
  });

  // DHL returns 404 with a JSON body for an unknown number — that's
  // "not found", not an error condition.
  if (res.status === 404) {
    return { ...empty, error: "No shipment found for that tracking number" };
  }
  if (!res.ok) {
    return { ...empty, error: res.error ?? `HTTP ${res.status}` };
  }

  const s = res.data?.shipments?.[0];
  if (!s) {
    return { ...empty, error: "No shipment found for that tracking number" };
  }

  // DHL's top-level status.statusCode can be stale (e.g. "transit" while
  // the newest event already says "delivered"). Events come newest-first,
  // so the first event is the true current state. Prefer it.
  const newest = s.events?.[0];

  return {
    found: true,
    tracking_number: s.id ?? trackingNumber,
    service: s.service ?? null,
    origin: s.origin?.address?.addressLocality ?? null,
    destination: s.destination?.address?.addressLocality ?? null,
    status_code: newest?.statusCode ?? s.status?.statusCode ?? null,
    status: s.status?.status ?? null,
    description: newest?.description ?? s.status?.description ?? null,
    last_update: newest?.timestamp ?? s.status?.timestamp ?? null,
    estimated_delivery: s.estimatedTimeOfDelivery ?? null,
    pieces: s.details?.totalNumberOfPieces ?? null,
    events: (s.events ?? []).map((e) => ({
      timestamp: e.timestamp ?? "",
      description: e.description ?? "",
      status_code: e.statusCode ?? null,
      location: e.location?.address?.addressLocality ?? null,
    })),
    error: null,
  };
}
