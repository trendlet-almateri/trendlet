/**
 * DHL tracking event → customer WhatsApp message.
 *
 * Source: "Trendlet DHL Status → Customer Messages". Only 8 of the ~27 events
 * DHL emits are customer-facing; the rest are deliberately silent.
 *
 * Two rules make this a state machine rather than a lookup table:
 *
 *  1. Each message is sent AT MOST ONCE per shipment. Several DHL statuses map
 *     to the same message (three different US-facility events all mean "in the
 *     US warehouses"), and the spec says to send only if not already sent.
 *
 *  2. Two statuses mean different things depending on where the shipment is in
 *     its journey, so events must be read oldest-first while tracking what has
 *     already happened:
 *       - "Customs clearance status updated" fires while the shipment is still
 *         in Bahrain (pre-arrival). Treating that as "arrived in Saudi" would
 *         tell the customer it landed days early. Only counts once the Riyadh
 *         arrival event has been seen.
 *       - "Shipment on hold" is silent during transit and customs, but AFTER
 *         clearance completes it means DHL failed to hand over to Trendlet HQ,
 *         which is the delay message.
 *
 * The DHL tracking number must never appear in a customer message (spec note);
 * enforced by the fact that no message body takes a tracking parameter.
 */

export type CustomerMessageKey =
  | "picked_up"
  | "usa_processing"
  | "departed_usa"
  | "arrived_ksa"
  | "customs_cleared"
  | "at_trendlet_hq"
  | "delay_after_customs"
  | "delay_3days";

export type PlannedMessage = {
  key: CustomerMessageKey;
  /** Timestamp of the DHL event that triggered it. */
  at: string;
  /** The event description, for audit/logging. */
  trigger: string;
};

/**
 * Every message opens with the order it refers to, because one DHL shipment
 * carries many customers' sub-orders and a customer may have several items in
 * the same consignment — without this they cannot tell which order moved.
 *
 *   {{1}} = sub-order number (e.g. 1535-01)
 *   {{2}} = product title
 *
 * Deliberately NOT the DHL tracking number: the spec forbids it appearing in
 * any customer message, and the sub-order number is the reference customers
 * already know from their invoice.
 */
const ORDER_REF = "🧾 طلبك رقم {{1}} — {{2}}\n\n";

/**
 * Message bodies, verbatim from the spec, each prefixed with ORDER_REF. These
 * are the source of truth for the Twilio content templates —
 * scripts/create-dhl-templates.mts builds the templates from this map, so the
 * repo and Twilio cannot drift.
 */
const BODIES: Record<CustomerMessageKey, string> = {
  picked_up:
    "هلا بك! 🤍 خبر جميل، تم تسليم شحنتك لشركة DHL Express، وبدأت الآن رحلتها من الولايات المتحدة إلى المملكة العربية السعودية ✨✈️\n" +
    "بنكون معك خطوة بخطوة، وبنطمنك على شحنتك أول بأول لين توصل بالسلامة بإذن الله 🙏",

  usa_processing:
    "تحديث لطيف على طلبك 📦\n" +
    "شحنتك الحين داخل مراكز DHL في الولايات المتحدة، وتمر بإجراءات الفحص والتجهيز المعتادة قبل ما تنطلق إلى السعودية ✨\n" +
    "كل شي ماشي طبيعي، وبنعلمك أول ما تغادر الشحنة باتجاه المملكة بإذن الله ✈️",

  departed_usa:
    "طلبك حلّق باتجاه السعودية! ✈️\n" +
    "غادرت شحنتك الولايات المتحدة، وهي الحين في رحلتها الجوية نحو المملكة 🌍\n" +
    "صارت أقرب لك، وبنرسل لك التحديث الجميل الجاي فور وصولها بإذن الله ✨",

  arrived_ksa:
    "وصلت شحنتك إلى السعودية! 🇸🇦\n" +
    "بدأت الحين إجراءات الفحص والتخليص الجمركي المعتادة، وفريقنا يتابعها خطوة بخطوة لين تخلص الإجراءات بسلام 🙏\n" +
    "بنطمنك فور ما تنتقل للمرحلة الجاية بإذن الله 🤍",

  customs_cleared:
    "خبر يفرّح! ✅ اكتملت الإجراءات الجمركية بنجاح\n" +
    "شحنتك الحين في طريقها إلى مقرنا في الرياض 🏢\n" +
    "وبمجرد وصولها، يبدأ فريقنا تجهيز طلبك للمرحلة الأخيرة من التوصيل إليك. باقي القليل وتصير عندك بإذن الله 🤍",

  at_trendlet_hq:
    "وصلت شحنتك إلى مقرنا في الرياض! 📦🇸🇦\n" +
    "بدأ فريقنا الحين فرز وتجهيز الطلبات وإصدار أرقام التتبع الداخلي بكل عناية ✨\n" +
    "انتبه لجوالك خلال الفترة الجاية، بتتواصل معك شركة التوصيل، وبنزودك برقم تتبع شحنتك الداخلي فور إصداره 🏢\n" +
    "شكرًا لثقتك وصبرك، طلبك صار قريب جدًا منك 🤍",

  delay_after_customs:
    "نحب نطمّنك على طلبك 🤍\n" +
    "اكتملت الإجراءات الجمركية لشحنتك بنجاح، لكن صار تأخير تشغيلي من شركة DHL أثناء تسليمها إلى مقرنا في الرياض.\n" +
    "لا تشيل هم 🙏 فريقنا يتابع الشحنة مباشرة مع DHL لاستكمال التسليم بأقرب وقت، وما يحتاج منك أي إجراء.\n" +
    "نعتذر لك عن التأخير الخارج عن إرادتنا، ونقدّر صبرك وتفهمك، وبنخبرك فور وصولها إلى مقرنا بإذن الله 🙏",

  delay_3days:
    "تحديث وطمأنة على طلبك 🤍\n" +
    "لسا نتابع شحنتك مباشرة مع شركة DHL، وهي حاليًا في مركزهم بالرياض بعد اكتمال إجراءاتها الجمركية، ويجري ترتيب إعادة تسليمها إلى مقرنا.\n" +
    "طلبك محفوظ وتحت متابعتنا، وما يحتاج منك التواصل مع DHL أو اتخاذ أي إجراء 🙏\n" +
    "بنبلغك فور استلام الشحنة وانتقال طلبك لمرحلة التوصيل الداخلي. شكرًا لصبرك وثقتك بـ Trendlet 🤍",
};

export const MESSAGE_BODIES: Record<CustomerMessageKey, string> = Object.fromEntries(
  Object.entries(BODIES).map(([k, body]) => [k, ORDER_REF + body]),
) as Record<CustomerMessageKey, string>;

/**
 * Approved Twilio content SIDs, created by scripts/create-dhl-templates.mts.
 * Kept in code rather than env for the same reason as the WhatsApp sender: a
 * missing env var silently disabled every send for two days.
 *
 * A message with no SID here is skipped and counted, never guessed.
 */
export const TEMPLATE_SIDS: Record<CustomerMessageKey, string> = {
  picked_up: "HXf9acf8dbfccb58bc531bbd7e33f8dc4e",
  usa_processing: "HXc80d5b9e13b68ff033e3a524b7267eba",
  departed_usa: "HX9c2a625310038364d2775f4b39a7c08c",
  arrived_ksa: "HX48ad6752bb921b631a65b0d91045ebd8",
  customs_cleared: "HX16daf4dd4afc085cd4d7e0e13809bebb",
  at_trendlet_hq: "HX3ed7bf293a284be3165b45707c9bb3bd",
  delay_after_customs: "HX286f445d4e1708795ef090fea18cedc4",
  delay_3days: "HXf4a80d76301c9cc5d8b6847710caf7ef",
};

/** Short English labels for the admin UI — the messages themselves are Arabic. */
export const MESSAGE_LABELS: Record<CustomerMessageKey, string> = {
  picked_up: "Picked up",
  usa_processing: "In US facility",
  departed_usa: "Left the US",
  arrived_ksa: "Arrived in KSA",
  customs_cleared: "Customs cleared",
  at_trendlet_hq: "At Trendlet HQ",
  delay_after_customs: "Delay",
  delay_3days: "Delay 3+ days",
};

/** Twilio content-template name per message (lowercase + underscores). */
export const TEMPLATE_NAMES: Record<CustomerMessageKey, string> = {
  picked_up: "dhl_picked_up",
  usa_processing: "dhl_usa_processing",
  departed_usa: "dhl_departed_usa",
  arrived_ksa: "dhl_arrived_ksa",
  customs_cleared: "dhl_customs_cleared",
  at_trendlet_hq: "dhl_at_trendlet_hq",
  delay_after_customs: "dhl_delay_after_customs",
  delay_3days: "dhl_delay_3days",
};

type Event = { timestamp: string; description: string; status_code?: string | null; location?: string | null };

const has = (s: string, ...needles: string[]) =>
  needles.every((n) => s.toLowerCase().includes(n.toLowerCase()));

/** Days a post-customs hold must persist before the second delay message. */
const HOLD_ESCALATION_DAYS = 3;

/**
 * Decides which customer messages a shipment's history warrants, in order.
 * Pure: same events always produce the same plan, so it is safe to re-run on
 * every poll and diff against what was already sent.
 */
export function planCustomerMessages(events: Event[], now = new Date()): PlannedMessage[] {
  // DHL returns newest-first; the state machine needs oldest-first.
  const ordered = [...events]
    .filter((e) => e.timestamp)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const plan: PlannedMessage[] = [];
  const sent = new Set<CustomerMessageKey>();
  const push = (key: CustomerMessageKey, e: Event) => {
    if (sent.has(key)) return;
    sent.add(key);
    plan.push({ key, at: e.timestamp, trigger: e.description });
  };

  let arrivedInKsa = false;
  let customsCleared = false;
  let holdAfterCustomsAt: string | null = null;

  for (const e of ordered) {
    const d = e.description ?? "";

    // ── Stage 1: pickup + US facilities ──────────────────────────────────
    if (has(d, "picked up")) {
      push("picked_up", e);
      continue;
    }
    if (has(d, "processed at", "elizabeth") || has(d, "sort facility", "cincinnati") || has(d, "processed at", "cincinnati")) {
      push("usa_processing", e);
      continue;
    }

    // ── Stage 2: departure from the US ───────────────────────────────────
    // Only the CINCINNATI departure means "left the country". The ELIZABETH
    // departure is an internal US hop and is silent.
    if (has(d, "departed", "cincinnati")) {
      push("departed_usa", e);
      continue;
    }

    // ── Stage 3: Riyadh arrival + customs ────────────────────────────────
    if (has(d, "sort facility", "riyadh")) {
      arrivedInKsa = true;
      push("arrived_ksa", e);
      continue;
    }
    if (has(d, "clearance processing complete")) {
      customsCleared = true;
      push("customs_cleared", e);
      continue;
    }
    // Clearance chatter counts as "arrived" only after the shipment really did.
    if (arrivedInKsa && !customsCleared && (has(d, "clearance event") || has(d, "customs clearance status updated"))) {
      push("arrived_ksa", e);
      continue;
    }

    // ── Stage 4: handed over to Trendlet HQ ──────────────────────────────
    if (has(d, "delivered")) {
      push("at_trendlet_hq", e);
      continue;
    }

    // ── Stage 5: delays, but only once customs is done ───────────────────
    if (customsCleared && (has(d, "on hold") || has(d, "not accepted") || has(d, "delivery attempted"))) {
      push("delay_after_customs", e);
      holdAfterCustomsAt = holdAfterCustomsAt ?? e.timestamp;
      continue;
    }
  }

  // A post-customs hold still unresolved after 3+ days gets the reassurance
  // message. "Unresolved" = never delivered to Trendlet HQ.
  if (holdAfterCustomsAt && !sent.has("at_trendlet_hq")) {
    const heldMs = now.getTime() - new Date(holdAfterCustomsAt).getTime();
    if (heldMs >= HOLD_ESCALATION_DAYS * 24 * 60 * 60 * 1000) {
      plan.push({ key: "delay_3days", at: holdAfterCustomsAt, trigger: "hold unresolved 3+ days" });
    }
  }

  return plan;
}
