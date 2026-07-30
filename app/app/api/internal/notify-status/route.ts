import { NextResponse } from "next/server";
import { notifyCustomerOnStatusChange } from "@/lib/integrations/twilio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Internal endpoint hit by the Supabase `trg_notify_status_change` trigger
 * (pg_net) whenever sub_orders.status changes. Runs on the CURRENT production
 * deployment regardless of which client/deployment wrote the status — this is
 * what makes customer notifications immune to stale tabs and old deployment
 * URLs, and it also covers direct DB updates that never passed through a
 * server action.
 *
 * Auth: Bearer <SUPABASE_SERVICE_ROLE_KEY> — already the highest-privilege
 * secret in the system and the only one guaranteed identical everywhere.
 */
export async function POST(req: Request) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    return NextResponse.json({ error: "service key not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { sub_order_id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.sub_order_id || !body.status) {
    return NextResponse.json({ error: "sub_order_id and status required" }, { status: 400 });
  }

  const result = await notifyCustomerOnStatusChange(body.sub_order_id, body.status);
  return NextResponse.json({ ok: true, ...result });
}
