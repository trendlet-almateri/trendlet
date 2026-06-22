/**
 * Admin-only DHL shipment-creation TEST route.
 *
 * Sends the real MyDHL API shipment payload server-side (from Vercel's network,
 * not a local hotspot) so we can validate the Basic-auth credentials + payload
 * against DHL's TEST endpoint and see the actual response.
 *
 * GET /api/admin/dhl-test-shipment
 *
 * Auth (DHL): Basic, read from env DHL_TEST_BASIC (the base64 user:pass). Falls
 * back to DHL_API_KEY. Never hardcode the credential.
 *
 * This is a throwaway diagnostic — once the real flow is wired into
 * lib/integrations/dhl.ts, remove this route.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();

  const basic = process.env.DHL_TEST_BASIC ?? process.env.DHL_API_KEY;
  if (!basic) {
    return NextResponse.json(
      { ok: false, error: "Set DHL_TEST_BASIC (base64 user:pass) in env." },
      { status: 400 },
    );
  }

  const url = "https://express.api.dhl.com/mydhlapi/test/shipments";

  const payload = {
    plannedShippingDateAndTime: "2026-06-18T10:00:00+03:00",
    pickup: { isRequested: false },
    productCode: "P",
    accounts: [{ typeCode: "shipper", number: "457343932" }],
    shipper: {
      postalAddress: {
        streetLines: ["123 Warehouse St"],
        cityName: "Riyadh",
        postalCode: "12345",
        countryCode: "SA",
      },
      contactInformation: {
        fullName: "Trendlet Warehouse",
        phone: "+966500000000",
        email: "ops@trendlet.com",
      },
    },
    receiver: {
      postalAddress: {
        streetLines: ["456 Customer St"],
        cityName: "Jeddah",
        postalCode: "23456",
        countryCode: "SA",
      },
      contactInformation: {
        fullName: "Test Customer",
        phone: "+966511111111",
        email: "test@example.com",
      },
    },
    content: {
      packages: [{ weight: 1.0, dimensions: { length: 20, width: 15, height: 10 } }],
      isCustomsDeclarable: false,
      description: "Test shipment",
      unitOfMeasurement: "metric",
    },
    outputImageProperties: {
      printerDPI: 300,
      encodingFormat: "pdf",
      imageOptions: [{ typeCode: "label", templateName: "ECOM26_84_001" }],
    },
  };

  // DHL requires a unique Message-Reference (28–36 chars).
  const messageRef = `trendlet-test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`.slice(0, 36);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Message-Reference": messageRef,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // keep raw text
    }

    return NextResponse.json(
      { ok: res.ok, status: res.status, messageRef, response: body },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 },
    );
  }
}
