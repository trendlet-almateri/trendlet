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
