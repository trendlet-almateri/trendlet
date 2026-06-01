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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SHOPIFY_API_VERSION = "2024-10";

export async function GET(req: Request) {
  await requireRole(["admin"]);

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param required" }, { status: 400 });
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!shopDomain || !accessToken) {
    return NextResponse.json(
      { error: "SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN must be set" },
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
