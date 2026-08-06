/**
 * Polls DHL for shipments still in flight and sends the customer WhatsApp
 * updates their new status warrants.
 *
 * Shape of the loop, per shipment:
 *   1. ask DHL for the tracking history (1 API call — the budgeted resource)
 *   2. planCustomerMessages() turns the whole history into the list of
 *      milestones it has earned
 *   3. anything already in shipment_message_log is skipped — so a status that
 *      has not changed since the last run sends nothing
 *   4. the rest go out, one per sub-order in the shipment, and are logged
 *
 * The plan is recomputed from the full history every run rather than diffed
 * against the previous poll, so a missed run self-heals and a message is never
 * sent twice: the UNIQUE (shipment_id, sub_order_id, message_key) constraint
 * is the real guarantee, not the in-memory check.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { apiCall } from "@/lib/api-client";
import { trackDhlShipment } from "@/lib/integrations/dhl";
import { normalizeSaudiPhone } from "@/lib/utils/phone";
import { contentVariables } from "@/lib/integrations/twilio";
import {
  planCustomerMessages,
  TEMPLATE_SIDS,
  type CustomerMessageKey,
} from "@/lib/shipping/dhl-customer-messages";

/** DHL stops moving after this, so we stop polling it. */
const TERMINAL_STATUSES = ["delivered", "failure"];

/**
 * DHL milestones that also move the order forward on the fulfilment board.
 * Staff stop pressing buttons at preparing_for_shipment, so from there the
 * shipment's own progress is what advances the sub-order.
 *
 * Both targets have notifies_customer = false, which is deliberate: the write
 * fires the status-change DB trigger, and if either were armed the customer
 * would get two messages for the same event — the DHL template and the status
 * template.
 */
const STATUS_FOR_MILESTONE: Partial<Record<CustomerMessageKey, string>> = {
  arrived_ksa: "arrived_in_ksa",
  at_trendlet_hq: "delivered_to_warehouse",
};

/** Service-role writes have no auth.uid(), so the trigger needs this set. */
const SYSTEM_USER_ID =
  process.env.TRENDLET_SYSTEM_USER_ID ?? "99126bae-c846-400e-9d36-7a0d34b3a1f6";

export type PollSummary = {
  shipments_checked: number;
  messages_sent: number;
  statuses_advanced: number;
  skipped_no_phone: number;
  skipped_no_template: number;
  errors: string[];
};

export async function pollDhlAndNotify(limit = 50): Promise<PollSummary> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;
  const out: PollSummary = {
    shipments_checked: 0,
    messages_sent: 0,
    statuses_advanced: 0,
    skipped_no_phone: 0,
    skipped_no_template: 0,
    errors: [],
  };

  const approved = await approvedTemplateSids();

  // Only shipments that can still change. A delivered shipment costs a DHL
  // call and can produce nothing new.
  const { data: active } = await sb
    .from("shipments")
    .select("id, tracking_number, status")
    .not("tracking_number", "is", null)
    .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(limit);

  for (const s of (active ?? []) as { id: string; tracking_number: string; status: string }[]) {
    out.shipments_checked++;
    try {
      const track = await trackDhlShipment(s.tracking_number);
      if (!track.found) continue;

      // Keep the row and our own copy of the history current.
      await sb
        .from("shipments")
        .update({
          status: track.status_code ?? s.status,
          delivered_at: track.status_code === "delivered" ? track.last_update : null,
          tracking_snapshot: track,
          tracking_synced_at: new Date().toISOString(),
        })
        .eq("id", s.id);

      const plan = planCustomerMessages(track.events);
      if (plan.length === 0) continue;

      // Who is in this shipment.
      const { data: links } = await sb
        .from("shipment_sub_orders")
        .select(`
          sub_order_id,
          sub_order:sub_orders (
            sub_order_number, product_title,
            order:orders ( customer:customers ( phone ) )
          )
        `)
        .eq("shipment_id", s.id);
      if (!links || links.length === 0) continue;

      // What has already gone out for this shipment.
      const { data: sentRows } = await sb
        .from("shipment_message_log")
        .select("sub_order_id, message_key")
        .eq("shipment_id", s.id);
      const alreadySent = new Set(
        ((sentRows ?? []) as { sub_order_id: string; message_key: string }[]).map(
          (r) => `${r.sub_order_id}:${r.message_key}`,
        ),
      );

      // Advance the board to the furthest milestone DHL has reported. Done
      // once per shipment rather than per message so a sub-order lands on its
      // final state instead of stepping through every intermediate one.
      const furthest = [...plan].reverse().find((m) => STATUS_FOR_MILESTONE[m.key]);
      if (furthest) {
        const target = STATUS_FOR_MILESTONE[furthest.key]!;
        const { data: moved } = await sb
          .from("sub_orders")
          .update({
            status: target,
            status_changed_at: new Date().toISOString(),
            status_changed_by: SYSTEM_USER_ID,
          })
          .in("id", (links as { sub_order_id: string }[]).map((l) => l.sub_order_id))
          .neq("status", target)
          .select("id");
        out.statuses_advanced += moved?.length ?? 0;
      }

      for (const link of links as never[]) {
        const l = link as unknown as {
          sub_order_id: string;
          sub_order: {
            sub_order_number: string;
            product_title: string | null;
            order: { customer: { phone: string | null } | null } | null;
          } | null;
        };
        const phone = l.sub_order?.order?.customer?.phone;
        const normalized = phone ? normalizeSaudiPhone(phone) : null;

        for (const msg of plan) {
          if (alreadySent.has(`${l.sub_order_id}:${msg.key}`)) continue;
          if (!normalized) { out.skipped_no_phone++; continue; }

          const sid = TEMPLATE_SIDS[msg.key];
          // Not approved by Meta = guaranteed rejection. Skipping keeps the
          // ledger clean so these messages are sent for real once approved.
          if (!sid || !approved.has(sid)) { out.skipped_no_template++; continue; }

          const res = await sendTemplate(sid, normalized, {
            "1": l.sub_order?.sub_order_number ?? "",
            "2": l.sub_order?.product_title ?? "",
          });
          if (!res.ok) {
            out.errors.push(`${s.tracking_number}/${msg.key}: ${res.error}`);
            continue;
          }
          // Logged only after Twilio accepted it, so a failure retries next run.
          await sb.from("shipment_message_log").insert({
            shipment_id: s.id,
            sub_order_id: l.sub_order_id,
            message_key: msg.key,
            twilio_sid: res.sid,
          });
          out.messages_sent++;
        }
      }
    } catch (e) {
      out.errors.push(`${s.tracking_number}: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  return out;
}

/**
 * Which templates Meta has actually approved.
 *
 * Sending an unapproved template is not a soft failure: Twilio accepts it,
 * WhatsApp rejects it moments later with error 63016, and the customer gets
 * nothing. Checking the message status afterwards races that rejection — the
 * first send is usually still "queued" when you look — so the check belongs
 * BEFORE the send, where it is deterministic.
 *
 * Fetched once per poll run and reused, so this costs at most 8 calls every
 * 6 hours.
 */
async function approvedTemplateSids(): Promise<Set<string>> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const approved = new Set<string>();
  if (!accountSid || !authToken) return approved;

  const auth = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
  await Promise.all(
    Object.values(TEMPLATE_SIDS).map(async (sid) => {
      try {
        const res = await fetch(`https://content.twilio.com/v1/Content/${sid}/ApprovalRequests`, {
          headers: { Authorization: auth },
        });
        if (!res.ok) return;
        const body = (await res.json()) as { whatsapp?: { status?: string } };
        if (body.whatsapp?.status === "approved") approved.add(sid);
      } catch {
        // Unknown approval state means "do not send" — the default already is.
      }
    }),
  );
  return approved;
}

const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+966552552787";

async function sendTemplate(
  contentSid: string,
  toPhone: string,
  vars: Record<string, string>,
): Promise<{ ok: boolean; sid: string | null; error: string | null }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return { ok: false, sid: null, error: "twilio creds missing" };

  const params = new URLSearchParams();
  params.set("To", `whatsapp:${toPhone}`);
  params.set("From", WHATSAPP_FROM);
  params.set("ContentSid", contentSid);
  // contentVariables collapses whitespace — product titles contain newlines
  // and Twilio 400s on those.
  params.set("ContentVariables", contentVariables(vars));

  const res = await apiCall<{ sid?: string }>({
    service: "twilio",
    endpoint: "/Messages",
    method: "POST",
    url: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  return { ok: res.ok, sid: res.data?.sid ?? null, error: res.error };
}

export type { CustomerMessageKey };
