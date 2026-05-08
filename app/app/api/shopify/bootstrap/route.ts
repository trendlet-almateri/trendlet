/**
 * POST /api/shopify/bootstrap
 *
 * One-time setup for the Shopify expiring-offline-token system. Takes a
 * non-expiring offline access token (the daily-rotating shpat_* you've
 * been using) and exchanges it for an expiring access_token + refresh_token
 * pair, then persists both to shopify_tokens.
 *
 * After this runs successfully, getValidToken(shop) will auto-refresh
 * forever. Only re-run if the refresh_token expires (90d) or a token
 * leak forces re-issuance.
 *
 * Auth: admin only.
 *
 * Body:
 *   shop:                   "trendlet.myshopify.com"
 *   client_id:              SHOPIFY_CLIENT_ID
 *   client_secret:          SHOPIFY_CLIENT_SECRET
 *   current_access_token:   the existing shpat_* (non-expiring or expiring)
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { persistToken, type ShopifyTokenResponse } from "@/lib/shopify/token-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  shop: z.string().trim().min(1).regex(/\.myshopify\.com$/, "Shop must end in .myshopify.com"),
  client_id: z.string().trim().min(1),
  client_secret: z.string().trim().min(1),
  current_access_token: z.string().trim().min(1),
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

  const { shop, client_id, client_secret, current_access_token } = parsed.data;

  // Token-exchange grant: migrates a non-expiring offline token to an
  // expiring one. Per Shopify, this revokes the original token.
  const response = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id,
        client_secret,
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token: current_access_token,
        subject_token_type:
          "urn:shopify:params:oauth:token-type:offline-access-token",
        requested_token_type:
          "urn:shopify:params:oauth:token-type:offline-access-token",
        expiring: "1",
      }),
    },
  );

  if (!response.ok) {
    const errBody = await response.text();
    return NextResponse.json(
      {
        error: "Shopify token exchange failed",
        status: response.status,
        message: errBody.slice(0, 500),
      },
      { status: 502 },
    );
  }

  const data = (await response.json()) as ShopifyTokenResponse;
  if (!data.access_token || !data.refresh_token) {
    return NextResponse.json(
      { error: "Shopify response missing access_token or refresh_token", data },
      { status: 502 },
    );
  }

  try {
    await persistToken(shop, data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Persist failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    shop,
    expires_in: data.expires_in,
    refresh_token_expires_in: data.refresh_token_expires_in,
    scope: data.scope ?? null,
  });
}
