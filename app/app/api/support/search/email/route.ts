/**
 * GET /api/support/search/email?q=<email>  — searchOrdersByEmail
 *
 * Read-only. Returns a capped list summary of orders for that customer
 * email (case-insensitive). Summaries only — the AI calls getOrderDetails
 * for full info on a chosen order.
 *
 * Auth: Authorization: Bearer <INTERNAL_AI_TOKEN>
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withSupport, supportError } from "@/lib/support/core";
import { searchOrdersByEmail } from "@/lib/support/orders";

export const dynamic = "force-dynamic";

const EmailSchema = z.string().trim().toLowerCase().email().max(254);

export async function GET(req: Request) {
  return withSupport(req, "/api/support/search/email", async () => {
    const url = new URL(req.url);
    const parsed = EmailSchema.safeParse(url.searchParams.get("q") ?? "");
    if (!parsed.success) {
      return supportError(
        "INVALID_INPUT",
        "A valid email address is required (?q=email).",
      );
    }

    const results = await searchOrdersByEmail(parsed.data);
    if (results.length === 0) {
      return supportError(
        "ORDER_NOT_FOUND",
        "No orders found for that email. Ask the customer to confirm the email used at checkout or provide an order number.",
      );
    }
    return NextResponse.json({
      found: true,
      query: "email",
      resultCount: results.length,
      results,
    });
  });
}
