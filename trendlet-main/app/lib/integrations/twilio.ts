/**
 * Twilio WhatsApp — customer status notifications.
 *
 * Triggered server-side after a sub_orders.status update where the new
 * status has notifies_customer = true. The trigger function lives in
 * notifyCustomerOnStatusChange below; call it from any code path that
 * mutates sub_orders.status (e.g. /deliveries actions, future Shopify
 * webhook updates, admin status changes).
 *
 * NO-OP if statuses.twilio_template_sid IS NULL for the new status.
 * Logs as 'skipped' so admins can audit which transitions need a SID.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { apiCall, logSkipped } from "@/lib/api-client";
import { normalizeSaudiPhone } from "@/lib/utils/phone";

export type NotifyResult = {
  mode: "live" | "skipped" | "missing-template" | "missing-phone";
  message_sid: string | null;
  error: string | null;
};

/**
 * Sends the Twilio template for `newStatus` to the customer associated
 * with `subOrderId`. Caller is responsible for the actual status change —
 * this is fire-and-don't-await-too-hard messaging.
 */
export async function notifyCustomerOnStatusChange(
  subOrderId: string,
  newStatus: string,
): Promise<NotifyResult> {
  const sb = createServiceClient();

  // 1) Look up the template SID and customer details in one go
  const { data: status } = await sb
    .from("statuses")
    .select("notifies_customer, twilio_template_sid, label_en")
    .eq("key", newStatus)
    .maybeSingle<{ notifies_customer: boolean; twilio_template_sid: string | null; label_en: string }>();

  if (!status?.notifies_customer) {
    return { mode: "skipped", message_sid: null, error: null };
  }

  if (!status.twilio_template_sid) {
    await logSkipped({
      service: "twilio",
      endpoint: "/Messages",
      reason: `no twilio_template_sid for status '${newStatus}'`,
    });
    return { mode: "missing-template", message_sid: null, error: null };
  }

  const { data: sub } = await sb
    .from("sub_orders")
    .select("sub_order_number, product_title, order:orders(customer:customers(phone))")
    .eq("id", subOrderId)
    .maybeSingle<{
      sub_order_number: string;
      product_title: string;
      order: { customer: { phone: string | null } | null } | null;
    }>();

  const phone = sub?.order?.customer?.phone;
  const normalized = phone ? normalizeSaudiPhone(phone) : null;
  if (!normalized) {
    await logSkipped({
      service: "twilio",
      endpoint: "/Messages",
      reason: "customer phone missing or not a Saudi number",
    });
    return { mode: "missing-phone", message_sid: null, error: null };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!accountSid || !authToken || !from) {
    await logSkipped({
      service: "twilio",
      endpoint: "/Messages",
      reason: "Twilio credentials not configured",
    });
    return { mode: "missing-template", message_sid: null, error: "twilio creds missing" };
  }

  // Twilio Content API: template SID + variables in JSON
  const params = new URLSearchParams();
  params.set("To", `whatsapp:${normalized}`);
  params.set("From", from);
  params.set("ContentSid", status.twilio_template_sid);
  params.set(
    "ContentVariables",
    JSON.stringify({ "1": sub?.sub_order_number ?? "", "2": sub?.product_title ?? "" }),
  );

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const res = await apiCall<{ sid?: string }>({
    service: "twilio",
    endpoint: "/Messages",
    method: "POST",
    url: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    return { mode: "live", message_sid: null, error: res.error };
  }

  // Stamp whatsapp_sent_at on the customer_invoice if delivered, else just return.
  return { mode: "live", message_sid: res.data?.sid ?? null, error: null };
}
