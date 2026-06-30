/**
 * DHL Express — MyDHL API shipment (label) creation.
 *
 * Production-approved 2026-06-30 (DHL ticket CS5700608). Auth = HTTP Basic
 * from env DHL_API_USERNAME:DHL_API_PASSWORD; base URL from env DHL_BASE
 * (prod = https://express.api.dhl.com/mydhlapi, test adds /test). Account
 * number from env DHL_ACCOUNT_NUMBER. The proven payload shape lives in
 * reference_dhl_debug_playbook: customerDetails.{shipper,receiver}Details
 * nesting, productCode P (intl) / N (domestic), exportDeclaration for intl,
 * line-item gross ≤ net weight, waybillDoc + commercial-invoice output.
 *
 * Staff fill every field on the create form (Saudi national-address data in
 * orders is incomplete), so this takes a fully-specified input — no order
 * auto-mapping here.
 */

import { apiCall } from "@/lib/api-client";

export type DhlContactAddress = {
  fullName: string;
  companyName?: string | null;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null; // KSA national: district / additional number
  addressLine3?: string | null; // KSA national: short address (4 letters + 4 digits)
  cityName: string;
  postalCode: string;
  countryCode: string; // ISO-2, e.g. "US", "SA"
};

export type DhlLineItem = {
  description: string;
  commodityCode: string; // HS code
  quantity: number;
  priceValue: number;
  priceCurrency: string; // e.g. "SAR"
  netWeight: number; // kg
  grossWeight: number; // kg (must be <= net per DHL)
  manufacturerCountry: string; // ISO-2
};

export type CreateLabelInput = {
  productCode: "P" | "N"; // P = international, N = domestic
  plannedShippingDateAndTime: string; // "2026-07-03T10:43:06 GMT+03:00"
  shipper: DhlContactAddress;
  receiver: DhlContactAddress;
  packageWeight: number; // kg
  dimensions: { length: number; width: number; height: number }; // cm
  declaredValue: number;
  declaredValueCurrency: string;
  description: string;
  isCustomsDeclarable: boolean;
  lineItems: DhlLineItem[]; // export declaration (required when isCustomsDeclarable)
  invoiceNumber: string;
  invoiceDate: string; // "2026-07-03"
};

export type CreateLabelResult = {
  tracking_number: string;
  /** base64-encoded PDF documents keyed by typeCode ("label", "invoice"). */
  documents: { typeCode: string; pdfBase64: string }[];
  error: string | null;
};

function dhlBasicAuth(): string | null {
  const user = process.env.DHL_API_USERNAME;
  const pass = process.env.DHL_API_PASSWORD;
  if (!user || !pass) return null;
  return Buffer.from(`${user}:${pass}`).toString("base64");
}

function addr(a: DhlContactAddress) {
  const postalAddress: Record<string, string> = {
    cityName: a.cityName,
    countryCode: a.countryCode,
    postalCode: a.postalCode,
    addressLine1: a.addressLine1,
  };
  if (a.addressLine2) postalAddress.addressLine2 = a.addressLine2;
  if (a.addressLine3) postalAddress.addressLine3 = a.addressLine3;
  return {
    postalAddress,
    contactInformation: {
      phone: a.phone,
      companyName: a.companyName ?? a.fullName,
      fullName: a.fullName,
    },
  };
}

export async function createDhlLabel(input: CreateLabelInput): Promise<CreateLabelResult> {
  const basic = dhlBasicAuth();
  const account = process.env.DHL_ACCOUNT_NUMBER;
  const baseUrl = process.env.DHL_BASE ?? "https://express.api.dhl.com/mydhlapi";

  if (!basic || !account) {
    return {
      tracking_number: "",
      documents: [],
      error: "DHL not configured: set DHL_API_USERNAME, DHL_API_PASSWORD, DHL_ACCOUNT_NUMBER",
    };
  }

  const body = {
    productCode: input.productCode,
    plannedShippingDateAndTime: input.plannedShippingDateAndTime,
    pickup: { isRequested: false },
    accounts: [{ number: account, typeCode: "shipper" }],
    outputImageProperties: {
      encodingFormat: "pdf",
      imageOptions: [
        { invoiceType: "commercial", isRequested: true, typeCode: "invoice" },
        { hideAccountNumber: false, isRequested: true, typeCode: "waybillDoc" },
      ],
    },
    customerDetails: {
      shipperDetails: addr(input.shipper),
      receiverDetails: addr(input.receiver),
    },
    content: {
      unitOfMeasurement: "metric",
      incoterm: "DAP",
      isCustomsDeclarable: input.isCustomsDeclarable,
      description: input.description,
      packages: [
        {
          weight: input.packageWeight,
          dimensions: input.dimensions,
        },
      ],
      declaredValue: input.declaredValue,
      declaredValueCurrency: input.declaredValueCurrency,
      ...(input.isCustomsDeclarable
        ? {
            exportDeclaration: {
              lineItems: input.lineItems.map((li, i) => ({
                number: i + 1,
                commodityCodes: [
                  { value: li.commodityCode, typeCode: "outbound" },
                  { value: li.commodityCode, typeCode: "inbound" },
                ],
                priceCurrency: li.priceCurrency,
                quantity: { unitOfMeasurement: "PCS", value: li.quantity },
                price: li.priceValue,
                description: li.description,
                weight: { netValue: li.netWeight, grossValue: li.grossWeight },
                exportReasonType: "permanent",
                manufacturerCountry: li.manufacturerCountry,
              })),
              invoice: { date: input.invoiceDate, number: input.invoiceNumber },
            },
          }
        : {}),
    },
  };

  // DHL requires a unique Message-Reference (28–36 chars).
  const messageRef = `trendlet-${Date.now()}-${randomHex(6)}`.slice(0, 36);

  const res = await apiCall<{
    shipmentTrackingNumber?: string;
    documents?: { typeCode?: string; content?: string }[];
    detail?: string;
    additionalDetails?: string[];
  }>({
    service: "dhl",
    endpoint: "/shipments",
    method: "POST",
    url: `${baseUrl}/shipments`,
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Message-Reference": messageRef,
    },
    body,
  });

  if (!res.ok || !res.data?.shipmentTrackingNumber) {
    // Surface DHL's own validation detail (e.g. "803: Account not allowed",
    // weight/address errors) so staff can fix the form — apiCall only reports
    // the HTTP status.
    const detail =
      res.data?.detail ??
      res.data?.additionalDetails?.join("; ") ??
      res.error ??
      "DHL did not return a tracking number";
    return { tracking_number: "", documents: [], error: detail };
  }

  return {
    tracking_number: res.data.shipmentTrackingNumber,
    documents: (res.data.documents ?? [])
      .filter((d) => d.content)
      .map((d) => ({ typeCode: d.typeCode ?? "document", pdfBase64: d.content as string })),
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
