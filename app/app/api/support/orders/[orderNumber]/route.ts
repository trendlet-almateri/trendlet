/**
 * GET /api/support/orders/:orderNumber  — getOrderDetails
 *
 * Read-only. Returns the order + ALL its sub-orders (each with its own
 * status + tracking), normalized. Status lives on sub_orders — an order
 * can have items in different states.
 *
 * Auth: Authorization: Bearer <INTERNAL_AI_TOKEN>
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withSupport, supportError } from "@/lib/support/core";
import { getOrderDetails } from "@/lib/support/orders";

export const dynamic = "force-dynamic";

// Shopify order numbers are short alphanumeric (+ optional #/-). Validate
// to reject junk before any query.
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
  return withSupport(req, "/api/support/orders/:orderNumber", async () => {
    const raw = decodeURIComponent(params.orderNumber ?? "");
    const parsed = ParamSchema.safeParse(raw.replace(/^#/, ""));
    if (!parsed.success) {
      return supportError(
        "INVALID_INPUT",
        "Order number format is invalid.",
      );
    }

    const result = await getOrderDetails(parsed.data);
    if (!result) {
      return supportError(
        "ORDER_NOT_FOUND",
        "No order found with that number. Ask the customer to re-check it or provide the email used at checkout.",
      );
    }
    return NextResponse.json(result);
  });
}
