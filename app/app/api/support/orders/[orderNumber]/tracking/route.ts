/**
 * GET /api/support/orders/:orderNumber/tracking  — getShipmentTracking
 *
 * Read-only. Returns shipment tracking for the order, grouped by
 * shipment (one shipment can cover several sub-orders). Normalized —
 * no internal shipment IDs, no carrier internals.
 *
 * Auth: Authorization: Bearer <INTERNAL_AI_TOKEN>
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withSupport, supportError } from "@/lib/support/core";
import { getShipmentTracking } from "@/lib/support/orders";

export const dynamic = "force-dynamic";

const ParamSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9#-]+$/);

export async function GET(
  req: Request,
  { params }: { params: { orderNumber: string } },
) {
  return withSupport(
    req,
    "/api/support/orders/:orderNumber/tracking",
    async () => {
      const raw = decodeURIComponent(params.orderNumber ?? "");
      const parsed = ParamSchema.safeParse(raw.replace(/^#/, ""));
      if (!parsed.success) {
        return supportError(
          "INVALID_INPUT",
          "Order number format is invalid.",
        );
      }

      const result = await getShipmentTracking(parsed.data);
      if (!result) {
        return supportError(
          "ORDER_NOT_FOUND",
          "No order found with that number. Ask the customer to re-check it or provide the email used at checkout.",
        );
      }
      return NextResponse.json(result);
    },
  );
}
