/**
 * GET /api/admin/shopify-product?id=<product_id>
 *
 * Fetches a single product from the Shopify Admin API and returns its
 * key fields — including product_type, which is NOT present on order
 * webhook payloads (orders only carry line-item title/vendor/sku).
 *
 * Auth: admin only.
 */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getValidToken, getDefaultShopDomain } from "@/lib/shopify/token-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SHOPIFY_API_VERSION = "2024-10";

export async function GET(req: Request) {
  await requireRole(["admin"]);

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param required" }, { status: 400 });
  }

  let shopDomain: string;
  let accessToken: string;
  try {
    shopDomain = getDefaultShopDomain();
    accessToken = await getValidToken(shopDomain);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Shopify token unavailable" },
      { status: 500 },
    );
  }

  const res = await fetch(
    `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/products/${id}.json` +
      `?fields=id,title,vendor,product_type,handle,status,tags`,
    {
      headers: { "X-Shopify-Access-Token": accessToken, Accept: "application/json" },
    },
  );

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json(
      { error: "Shopify products/{id}.json failed", status: res.status, message: body.slice(0, 500) },
      { status: 502 },
    );
  }

  const data = (await res.json()) as { product?: Record<string, unknown> };
  return NextResponse.json({ ok: true, product: data.product ?? null });
}
