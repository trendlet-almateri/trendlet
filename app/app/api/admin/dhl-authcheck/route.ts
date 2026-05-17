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
    // DHL's raw error body on failure — shown here so we can read the exact
    // validation message. Diagnostic only; never written to api_logs.
    dhl_detail: result.dhl_detail,
    hint:
      result.mode === "skipped"
        ? "DHL_API_USERNAME / DHL_API_PASSWORD / DHL_API_BASE missing in this environment."
        : result.ok
          ? "Credentials valid — DHL accepted the rate request."
          : result.http_status === 401 || result.http_status === 403
            ? `HTTP ${result.http_status} — bad DHL credentials.`
            : `HTTP ${result.http_status} — auth OK, request rejected. See dhl_detail for the exact reason.`,
  });
}
