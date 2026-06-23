/**
 * DHL shipment-creation TEST route (throwaway diagnostic).
 *
 * Sends the real MyDHL API shipment payload server-side (from Vercel's network,
 * not a local hotspot — local POSTs to DHL get connection-reset) so we can
 * validate the Basic-auth credentials + payload against DHL's TEST endpoint and
 * see the actual response.
 *
 *   GET /api/admin/dhl-test-shipment?token=trendlet-dhl-probe-7f3a91c2
 *
 * Gate: a URL ?token= (not a login) so it can be hit by just opening a URL.
 * DHL auth: Basic, read from env DHL_TEST_BASIC (the base64 user:pass), fallback
 * DHL_API_KEY. The credential is NEVER hardcoded — set it in Vercel env.
 *
 * Remove this route once the real flow is wired into lib/integrations/dhl.ts.
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Throwaway URL-token gate so the route can be hit by just opening a URL (no
// admin login). The token is NOT a secret credential — it only stops random
// public traffic from triggering the DHL test. Removed with the route.
const TEST_TOKEN = "trendlet-dhl-probe-7f3a91c2";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== TEST_TOKEN) {
    return NextResponse.json({ ok: false, error: "Missing or wrong ?token=" }, { status: 401 });
  }

  const usedVar = process.env.DHL_TEST_BASIC
    ? "DHL_TEST_BASIC"
    : process.env.DHL_API_KEY
      ? "DHL_API_KEY (fallback)"
      : null;
  const basic = process.env.DHL_TEST_BASIC ?? process.env.DHL_API_KEY;
  if (!basic) {
    return NextResponse.json(
      { ok: false, error: "Set DHL_TEST_BASIC (base64 user:pass) in env." },
      { status: 400 },
    );
  }

  // Safe diagnostic — decoded USERNAME only (password redacted) so we can confirm
  // WHICH credential the build is actually using (new apJ8... vs old apT4...).
  let decodedUser = "(decode failed)";
  let basicLen = basic.length;
  try {
    const decoded = Buffer.from(basic, "base64").toString("utf8");
    const colon = decoded.indexOf(":");
    decodedUser = colon > 0 ? decoded.slice(0, colon) : "(no colon)";
  } catch {
    // keep default
  }
  const cred = { usedVar, decodedUser, basicLen };

  const url = "https://express.api.dhl.com/mydhlapi/test/shipments";

  // Payload mirrors DHL's official Postman collection "Domestic Shipment
  // Request" (ticket CS5700608): productCode "N" (domestic), account 458548514,
  // customerDetails.{shipperDetails,receiverDetails} nesting (NOT flat
  // shipper/receiver), waybillDoc output. Plain dates with GMT offset.
  const payload = {
    plannedShippingDateAndTime: "2026-06-30T10:43:06 GMT+03:00",
    pickup: { isRequested: false },
    outputImageProperties: {
      encodingFormat: "pdf",
      imageOptions: [
        { hideAccountNumber: false, isRequested: false, typeCode: "waybillDoc" },
      ],
    },
    productCode: "N",
    accounts: [{ number: "458548514", typeCode: "shipper" }],
    customerDetails: {
      shipperDetails: {
        postalAddress: {
          postalCode: "13337",
          cityName: "Riyadh",
          countryCode: "SA",
          addressLine1: "2929, Raihana Bint Zaid Street",
          addressLine2: "Al Olaya District",
          addressLine3: "SPLD2929",
        },
        contactInformation: {
          phone: "+1234567890",
          companyName: "Shipper Company",
          fullName: "Shipper Name",
        },
      },
      receiverDetails: {
        postalAddress: {
          cityName: "Riyadh",
          countryCode: "SA",
          postalCode: "13337",
          addressLine1: "2929, Raihana Bint Zaid Street",
          addressLine2: "Al Olaya District",
          addressLine3: "SPLD2929",
        },
        contactInformation: {
          phone: "1234567890",
          companyName: "Receiver Company",
          fullName: "Receiver Name",
        },
      },
    },
    content: {
      unitOfMeasurement: "metric",
      incoterm: "DAP",
      isCustomsDeclarable: false,
      description: "Cosmetics: Skincare",
      packages: [
        { weight: 1.097, dimensions: { length: 18, width: 13, height: 13 } },
      ],
      declaredValue: 3,
      declaredValueCurrency: "KGS",
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
      { ok: res.ok, status: res.status, cred, messageRef, response: body },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 },
    );
  }
}
