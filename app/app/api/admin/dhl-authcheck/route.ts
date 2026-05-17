/**
 * GET /api/admin/dhl-authcheck — Phase-1 DHL auth proof.
 *
 * Calls MyDHL `POST /rates` ONCE (a price quote — creates NOTHING) to verify
 * DHL_API_USERNAME/PASSWORD/BASE are valid. Admin-only. Costs 1 DHL request.
 * Returns whether auth succeeded, the HTTP status, and a product count.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { dhlRateCheck } from "@/lib/integrations/dhl";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const result = await dhlRateCheck();
  return NextResponse.json({
    configured: result.mode !== "skipped",
    auth_ok: result.ok,
    http_status: result.http_status,
    rate_products_returned: result.products,
    error: result.error,
    hint:
      result.mode === "skipped"
        ? "DHL_API_USERNAME / DHL_API_PASSWORD / DHL_API_BASE missing in this environment."
        : result.ok
          ? "Credentials valid — DHL accepted the rate request."
          : `Auth/request failed (HTTP ${result.http_status}). 401/403 = bad credentials.`,
  });
}
