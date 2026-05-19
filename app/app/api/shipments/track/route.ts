import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { trackDhlShipment } from "@/lib/integrations/dhl";

export async function GET(req: Request) {
  await requireAdmin();
  const tn = new URL(req.url).searchParams.get("trackingNumber")?.trim();
  if (!tn) {
    return NextResponse.json({ found: false, error: "Missing trackingNumber" }, { status: 400 });
  }
  const result = await trackDhlShipment(tn);
  return NextResponse.json(result);
}
