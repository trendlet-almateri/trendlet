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
  // Global kill-switch for testing status flows without spamming customers.
  // Set TWILIO_NOTIFICATIONS_ENABLED=false on the deployment (or omit, since
  // unset is treated as enabled). When disabled, every status change logs
  // as 'skipped' and no Twilio call is made.
  if (process.env.TWILIO_NOTIFICATIONS_ENABLED === "false") {
    await logSkipped({
      service: "twilio",
      endpoint: "/Messages",
      reason: `notifications disabled (TWILIO_NOTIFICATIONS_ENABLED=false), status='${newStatus}'`,
    });
    return { mode: "skipped", message_sid: null, error: null };
  }

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

  // Mirror the notification into the kind-ai support inbox so agents can see
  // that this message went to this customer. Best-effort: a failure here must
  // not affect the Twilio result, which already succeeded.
  void mirrorToSupportInbox({
    phone: normalized,
    message: `${status.label_en} — ${sub?.sub_order_number ?? ""} ${sub?.product_title ?? ""}`.trim(),
    message_sid: res.data?.sid ?? null,
  }).catch((e) => console.error("[twilio] mirror to support inbox failed", e));

  return { mode: "live", message_sid: res.data?.sid ?? null, error: null };
}

/**
 * Send an invoice PDF to the customer over WhatsApp using the approved
 * document media template (TWILIO_INVOICE_TEMPLATE_SID).
 *
 * The template's Media URL is `https://<supabase-host>/{{2}}`, so {{2}} is the
 * signed-URL path AFTER the origin (storage/v1/object/sign/...?token=...).
 * {{1}} is the sub-order number shown in the body text.
 *
 * Gated OFF by default: sends only when INVOICE_WHATSAPP_ENABLED=true AND the
 * template SID is configured — so nothing fires until the template is approved
 * by Meta and the operator flips the env var.
 */
export async function sendInvoicePdfWhatsApp(input: {
  phone: string | null | undefined;
  subOrderNumber: string;
  /** Full signed URL of the invoice PDF (https://...supabase.co/storage/...token=...) */
  signedPdfUrl: string;
}): Promise<NotifyResult> {
  if (process.env.INVOICE_WHATSAPP_ENABLED !== "true") {
    return { mode: "skipped", message_sid: null, error: null };
  }
  const templateSid = process.env.TWILIO_INVOICE_TEMPLATE_SID;
  if (!templateSid) {
    await logSkipped({
      service: "twilio",
      endpoint: "/Messages",
      reason: "TWILIO_INVOICE_TEMPLATE_SID not set (invoice PDF send)",
    });
    return { mode: "missing-template", message_sid: null, error: null };
  }

  const normalized = input.phone ? normalizeSaudiPhone(input.phone) : null;
  if (!normalized) {
    await logSkipped({
      service: "twilio",
      endpoint: "/Messages",
      reason: `invoice PDF: customer phone missing or not Saudi (sub-order ${input.subOrderNumber})`,
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
      reason: "Twilio credentials not configured (invoice PDF send)",
    });
    return { mode: "missing-template", message_sid: null, error: "twilio creds missing" };
  }

  // {{2}} = everything after the origin, since the template hardcodes the host.
  const pathAfterOrigin = input.signedPdfUrl.replace(/^https:\/\/[^/]+\//, "");

  const params = new URLSearchParams();
  params.set("To", `whatsapp:${normalized}`);
  params.set("From", from);
  params.set("ContentSid", templateSid);
  params.set(
    "ContentVariables",
    JSON.stringify({ "1": input.subOrderNumber, "2": pathAfterOrigin }),
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

  if (!res.ok) return { mode: "live", message_sid: null, error: res.error };

  void mirrorToSupportInbox({
    phone: normalized,
    message: `فاتورة طلبك رقم ${input.subOrderNumber} (invoice PDF sent)`,
    message_sid: res.data?.sid ?? null,
  }).catch((e) => console.error("[twilio] invoice mirror failed", e));

  return { mode: "live", message_sid: res.data?.sid ?? null, error: null };
}

/**
 * Fire-and-forget POST to the kind-ai support inbox. Records the outbound
 * order-status message in the customer's conversation thread there.
 * No-op (logged) when SUPPORT_INBOX_URL / SUPPORT_INBOX_TOKEN aren't set.
 */
async function mirrorToSupportInbox(payload: {
  phone: string;
  message: string;
  message_sid: string | null;
}): Promise<void> {
  const url = process.env.SUPPORT_INBOX_URL;
  const token = process.env.SUPPORT_INBOX_TOKEN;
  if (!url || !token) return;

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
