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
 * DHL milestones that also move the board, using the statuses the team already
 * works with. DHL knows these events first — it physically has the box — so
 * the employee does not have to re-enter what DHL has already reported.
 *
 * Deliberately NOT arrived_in_ksa (not part of the live flow) and NOT
 * delivered_to_warehouse (that means the US warehouse, so setting it from a
 * Riyadh arrival would push orders backwards).
 *
 * Safe because both targets were disarmed: the write fires the status-change
 * trigger, and if either still notified, the customer would get the DHL
 * message and the status message for the same event.
 */
const STATUS_FOR_MILESTONE: Partial<Record<CustomerMessageKey, string>> = {
  picked_up: "shipped",
  // DHL delivering to the Riyadh office closes the order. Note this means
  // `delivered` records "arrived at Trendlet Riyadh", not "the customer has
  // it" — the last mile is handled off-system, and the customer's final
  // message (dhl_at_trendlet_hq) tells them the courier will be in touch.
  at_trendlet_hq: "delivered",
};

/** Service-role writes have no auth.uid(), so the trigger needs this set. */
const SYSTEM_USER_ID =
  process.env.TRENDLET_SYSTEM_USER_ID ?? "99126bae-c846-400e-9d36-7a0d34b3a1f6";

/** Statuses already at or past the target — never move an order backwards. */
const AT_OR_PAST: Record<string, string[]> = {
  shipped: ["shipped", "arrived_in_ksa", "out_for_delivery", "delivered", "returned", "cancelled"],
  delivered: ["delivered", "returned", "cancelled"],
};

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

      // Move the board to the furthest milestone DHL has reported, skipping any
      // sub-order already at or past it so a late poll cannot rewind an order a
      // human has since advanced.
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
          .not("status", "in", `(${(AT_OR_PAST[target] ?? [target]).join(",")})`)
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
 * Send one milestone to one customer on demand — the manual override for when
 * DHL is wrong, late, or silent and staff need to tell the customer anyway.
 *
 * Writes the same ledger as the poller, so a manual send and the automatic one
 * can never both go out: whichever happens first claims the row.
 */
export async function sendMilestoneNow(input: {
  shipmentId: string;
  subOrderId: string;
  key: CustomerMessageKey;
}): Promise<{ ok: boolean; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any;

  const sid = TEMPLATE_SIDS[input.key];
  if (!sid) return { ok: false, error: "No template for this message." };

  const approved = await approvedTemplateSids();
  if (!approved.has(sid)) {
    return { ok: false, error: "WhatsApp has not approved this template yet, so it cannot be sent." };
  }

  const { data: sub } = await sb
    .from("sub_orders")
    .select("sub_order_number, product_title, order:orders ( customer:customers ( phone ) )")
    .eq("id", input.subOrderId)
    .maybeSingle();
  if (!sub) return { ok: false, error: "Order not found." };

  const raw = sub as {
    sub_order_number: string;
    product_title: string | null;
    order: { customer: { phone: string | null } | null } | null;
  };
  const phone = raw.order?.customer?.phone;
  const normalized = phone ? normalizeSaudiPhone(phone) : null;
  if (!normalized) return { ok: false, error: "This customer has no usable Saudi phone number." };

  const res = await sendTemplate(sid, normalized, {
    "1": raw.sub_order_number ?? "",
    "2": raw.product_title ?? "",
  });
  if (!res.ok) return { ok: false, error: res.error ?? "Twilio rejected the message." };

  const { error } = await sb.from("shipment_message_log").insert({
    shipment_id: input.shipmentId,
    sub_order_id: input.subOrderId,
    message_key: input.key,
    twilio_sid: res.sid,
  });
  // A conflict means the poller sent it between the button press and now —
  // the customer has it either way, so this is not an error.
  if (error && !/duplicate key/i.test(error.message)) {
    return { ok: false, error: `Sent, but recording it failed: ${error.message}` };
  }
  return { ok: true, error: null };
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
