/**
 * Confirmation-modal preview for the 7 customer-notify Twilio templates.
 *
 * Source of truth for what's actually sent: Twilio Content Templates
 * (statuses.twilio_template_sid). The bodies below are mirrored from
 * Twilio so the confirmation modal can show the operator exactly what
 * the customer will receive before they confirm. Keep in sync with
 * Twilio Console if templates are edited.
 *
 * Variables: {{1}} = sub-order number, {{2}} = product title.
 */

export type CustomerStatusKey =
  | "under_review"
  | "purchased_online"
  | "purchased_in_store"
  | "out_of_stock"
  | "preparing_for_shipment"
  | "shipped"
  | "delivered";

export const TWILIO_STATUS_TEMPLATES: Record<
  CustomerStatusKey,
  { sid: string; bodyAr: string }
> = {
  under_review: {
    sid: "HX864cc4f3ea78bc36040ba476ba3e62e5",
    bodyAr:
      "👀 طلبك رقم {{1}} {{2}} قيد المراجعة حالياً، ونشتغل عليه بكل اهتمام 🤍\nبنبلغك أول ما يكون فيه تحديث.",
  },
  purchased_online: {
    sid: "HXda7be5e1f9eec8e4929573b4671d5c15",
    bodyAr:
      "🛍️✨ تم شراء طلبك أونلاين بنجاح!\nطلبك رقم {{1}} ({{2}}) تحت الإجراء الآن، شكراً لثقتك 🤍",
  },
  purchased_in_store: {
    sid: "HXe9292a1b1713fdf4eb023aa0a2c8ae21",
    bodyAr:
      "🏪🤍 سعدنا بخدمتك!\nتم شراء الطلب رقم {{1}} ({{2}}) من المتجر بنجاح.",
  },
  out_of_stock: {
    sid: "HXf9b177f834b7de0593b47c757920c8cb",
    bodyAr:
      "😔 نعتذر، الطلب رقم {{1}} ({{2}}) غير متوفر حالياً.\nبنبلغك فور توفره بإذن الله 🤍",
  },
  preparing_for_shipment: {
    sid: "HX329959132816310be54b48524a24cefd",
    bodyAr:
      "📦✈️ يتم الآن تجهيز طلبك رقم {{1}} ({{2}}) للشحن إلى السعودية، بنوصله لك بأسرع وقت 🤍",
  },
  shipped: {
    sid: "HX177984255ec5f0a67ed6add555dd16af",
    bodyAr:
      "🚚🇸🇦 تم شحن طلبك رقم {{1}} ({{2}}) إلى السعودية بنجاح!\nنشاركك التفاصيل أول بأول ✨",
  },
  delivered: {
    sid: "HX250c16c81704b3ab496f53bab4543c84",
    bodyAr:
      "🎉🇸🇦 تم توصيل طلبك رقم {{1}} ({{2}}) بنجاح إلى السعودية!\nنتمنى يعجبك، وشكراً لاختيارك لنا 🤍",
  },
};

export function isCustomerNotifyStatus(key: string): key is CustomerStatusKey {
  return key in TWILIO_STATUS_TEMPLATES;
}

/** Replace {{1}} and {{2}} in the template body with real values. */
export function renderTemplateBody(
  bodyAr: string,
  vars: { subOrderNumber: string; productTitle: string },
): string {
  return bodyAr
    .replaceAll("{{1}}", vars.subOrderNumber)
    .replaceAll("{{2}}", vars.productTitle);
}
