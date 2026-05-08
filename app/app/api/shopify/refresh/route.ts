/**
 * POST /api/shopify/refresh
 *
 * Manually refresh the Shopify access_token for a shop. Normally
 * getValidToken(shop) handles this transparently — this endpoint exists
 * for ops/debugging when admin wants to force-rotate the token (e.g.
 * after a suspected leak) or verify the refresh flow works end-to-end.
 *
 * Auth: admin only.
 *
 * Body: { shop: "trendlet.myshopify.com" }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { refreshToken, getTokenFromDB } from "@/lib/shopify/token-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  shop: z.string().trim().min(1),
});

export async function POST(req: Request) {
  await requireRole(["admin"]);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    await refreshToken(parsed.data.shop);
    const fresh = await getTokenFromDB(parsed.data.shop);
    return NextResponse.json({
      ok: true,
      shop: parsed.data.shop,
      expires_at: fresh?.expires_at,
      refresh_token_expires_at: fresh?.refresh_token_expires_at,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Refresh failed" },
      { status: 500 },
    );
  }
}
