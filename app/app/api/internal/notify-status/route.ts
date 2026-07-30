import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
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
 * Auth: one-time nonce. The trigger inserts a row into notify_nonces and
 * posts only the nonce; we consume (delete) it here with the service client.
 * A nonce can't be forged without DB write access and can't be replayed, so
 * no shared secret needs to live inside the trigger definition.
 */
export async function POST(req: Request) {
  let body: { nonce?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.nonce) {
    return NextResponse.json({ error: "nonce required" }, { status: 400 });
  }

  // notify_nonces comes from migration 20260730000002 and isn't in the
  // generated Database types yet — cast until types are regenerated.
  const sb = createServiceClient() as ReturnType<typeof createServiceClient> & {
    from: (table: string) => ReturnType<ReturnType<typeof createServiceClient>["from"]>;
  };

  // Consume the nonce: delete-returning guarantees single use. Reject stale
  // nonces so a leaked DB backup can't replay old ones.
  const { data: row } = await sb
    .from("notify_nonces")
    .delete()
    .eq("nonce", body.nonce)
    .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .select("sub_order_id, status")
    .maybeSingle<{ sub_order_id: string; status: string }>();

  if (!row) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Opportunistic cleanup of nonces that never got consumed (endpoint was
  // unreachable when they fired). Best-effort.
  void sb
    .from("notify_nonces")
    .delete()
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .then(() => {});

  const result = await notifyCustomerOnStatusChange(row.sub_order_id, row.status);
  return NextResponse.json({ ok: true, ...result });
}
