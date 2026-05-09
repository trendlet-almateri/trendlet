/* eslint-disable @typescript-eslint/no-explicit-any */
// react-pdf's JSX intrinsics conflict with React 18's JSX type narrowing in
// strict mode; the casts are localized to this single file.

import * as React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";

/**
 * "Trendslet by Almateri" — full system overview PDF.
 *
 * Generated from the in-repo feature inventory so the same source of
 * truth produces both the in-app docs and the shareable PDF. Render
 * with renderTrendletOverviewPdf() — see scripts/generate-overview-pdf.mjs.
 */

const COLORS = {
  ink:        "#0f1419",
  inkSoft:    "#2a3038",
  muted:      "#6b7280",
  hairline:   "#e7e5df",
  navy:       "#0C447C",
  navyDeep:   "#07264a",
  gold:       "#B8801A",
  goldSoft:   "#F5D063",
  page:       "#F8F7F4",
  white:      "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    padding: 48,
    paddingTop: 56,
    fontSize: 10,
    lineHeight: 1.55,
    fontFamily: "Helvetica",
    color: COLORS.ink,
    backgroundColor: COLORS.page,
  },

  /* Cover page */
  coverPage: {
    padding: 0,
    fontFamily: "Helvetica",
    color: COLORS.white,
    backgroundColor: "#0a0a0e",
    position: "relative",
  },
  coverInner: {
    padding: 56,
    height: "100%",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  coverTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brandMark: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: COLORS.goldSoft,
  },
  metaCol: {
    fontSize: 8,
    color: "#9aa0aa",
    textAlign: "right",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  coverTitleBlock: {
    flexDirection: "column",
    gap: 8,
  },
  coverEyebrow: {
    fontSize: 10,
    color: COLORS.gold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  coverTitle: {
    fontSize: 56,
    fontFamily: "Helvetica-Bold",
    letterSpacing: -1.4,
    lineHeight: 1.05,
    marginTop: 12,
    color: COLORS.white,
  },
  coverSub: {
    marginTop: 16,
    fontSize: 13,
    lineHeight: 1.55,
    color: "#cfd2d8",
    maxWidth: 380,
  },
  coverFootRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 24,
    borderTopWidth: 0.5,
    borderTopColor: "#262a32",
  },
  coverFootLabel: {
    fontSize: 8,
    color: "#9aa0aa",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  coverFootValue: {
    fontSize: 11,
    color: COLORS.white,
    marginTop: 4,
  },
  goldRule: {
    width: 80,
    height: 3,
    backgroundColor: COLORS.gold,
    marginBottom: 24,
  },

  /* Body pages */
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.hairline,
    marginBottom: 24,
  },
  pageHeaderBrand: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: COLORS.navy,
  },
  pageHeaderMeta: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  pageFooter: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: COLORS.muted,
  },

  /* Section structure */
  sectionNumber: {
    fontSize: 30,
    fontFamily: "Helvetica-Bold",
    color: COLORS.gold,
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: COLORS.ink,
    marginTop: 4,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  sectionLead: {
    fontSize: 10,
    lineHeight: 1.55,
    color: COLORS.inkSoft,
    marginBottom: 14,
  },
  subTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: COLORS.ink,
    marginTop: 14,
    marginBottom: 6,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 4,
    paddingRight: 8,
  },
  bulletDot: {
    width: 14,
    fontSize: 10,
    color: COLORS.gold,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 1.5,
    color: COLORS.inkSoft,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.55,
    color: COLORS.inkSoft,
    marginBottom: 8,
  },

  /* Table primitive */
  table: {
    marginTop: 8,
    marginBottom: 12,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.hairline,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.hairline,
    paddingVertical: 6,
  },
  tableHeaderRow: {
    backgroundColor: "#efece4",
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: COLORS.muted,
    paddingHorizontal: 8,
  },
  tableCell: {
    fontSize: 9,
    color: COLORS.inkSoft,
    paddingHorizontal: 8,
    lineHeight: 1.45,
  },

  /* TOC */
  tocRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.hairline,
  },
  tocNumber: {
    fontSize: 9,
    color: COLORS.gold,
    fontFamily: "Helvetica-Bold",
    width: 24,
    letterSpacing: 0.6,
  },
  tocTitle: {
    fontSize: 10,
    color: COLORS.ink,
    flex: 1,
  },
  tocPage: {
    fontSize: 9,
    color: COLORS.muted,
    fontFamily: "Helvetica-Bold",
  },

  /* Stat strip on the cover */
  statStrip: {
    flexDirection: "row",
    gap: 12,
  },
  statTile: {
    flex: 1,
    padding: 14,
    borderWidth: 0.5,
    borderColor: "#262a32",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  statTileLabel: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#9aa0aa",
  },
  statTileValue: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: COLORS.goldSoft,
    marginTop: 6,
    letterSpacing: -0.5,
  },
  statTileCaption: {
    fontSize: 8,
    color: "#9aa0aa",
    marginTop: 4,
  },
});

/* ── primitives ─────────────────────────────────────────────────────── */

const Bullet = ({ children }: { children: any }) => {
  const s: any = styles;
  return (
    <View style={s.bullet}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
};

const PageChrome = ({ pageNumber, children }: { pageNumber: number; children: any }) => {
  const s: any = styles;
  return (
    <Page size="A4" style={s.page}>
      <View style={s.pageHeader}>
        <Text style={s.pageHeaderBrand}>Trendslet · by Almateri</Text>
        <Text style={s.pageHeaderMeta}>System Overview · 2026</Text>
      </View>
      {children}
      <View style={s.pageFooter} fixed>
        <Text>Confidential</Text>
        <Text>Page {pageNumber}</Text>
      </View>
    </Page>
  );
};

type SectionProps = {
  number: string;
  title: string;
  lead?: string;
  pageNumber: number;
  children: any;
};

const Section = ({ number, title, lead, pageNumber, children }: SectionProps) => {
  const s: any = styles;
  return (
    <PageChrome pageNumber={pageNumber}>
      <Text style={s.sectionNumber}>{number}</Text>
      <Text style={s.sectionTitle}>{title}</Text>
      {lead && <Text style={s.sectionLead}>{lead}</Text>}
      {children}
    </PageChrome>
  );
};

/* ── document ──────────────────────────────────────────────────────── */

const TrendletOverviewDocument = () => {
  const s: any = styles;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Document
      title="Trendslet — System Overview"
      author="Almateri"
      subject="Trendslet OMS feature inventory"
      keywords="trendslet, almateri, oms, overview"
    >
      {/* COVER */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverInner}>
          <View style={s.coverTopRow}>
            <Text style={s.brandMark}>Almateri</Text>
            <View style={s.metaCol}>
              <Text>Internal · System overview</Text>
              <Text>Generated {today}</Text>
            </View>
          </View>

          <View style={s.coverTitleBlock}>
            <Text style={s.coverEyebrow}>Trendslet</Text>
            <Text style={s.coverTitle}>The fulfilment{"\n"}operating system.</Text>
            <Text style={s.coverSub}>
              From a customer's order on a brand's Shopify store, through sourcing,
              warehouse, and KSA last-mile — Trendslet runs the whole pipeline,
              prices it, invoices it, and delivers it.
            </Text>
          </View>

          <View>
            <View style={[s.statStrip, { marginBottom: 32 }] as any}>
              <View style={s.statTile}>
                <Text style={s.statTileLabel}>Workflow stages</Text>
                <Text style={s.statTileValue}>5</Text>
                <Text style={s.statTileCaption}>17 statuses, role-gated</Text>
              </View>
              <View style={s.statTile}>
                <Text style={s.statTileLabel}>Roles</Text>
                <Text style={s.statTileValue}>5</Text>
                <Text style={s.statTileCaption}>Admin · sourcing · warehouse · fulfiller · ksa</Text>
              </View>
              <View style={s.statTile}>
                <Text style={s.statTileLabel}>Live integrations</Text>
                <Text style={s.statTileValue}>6</Text>
                <Text style={s.statTileCaption}>Shopify · Zoho · OpenRouter · Hubstaff · Supabase · Vercel</Text>
              </View>
              <View style={s.statTile}>
                <Text style={s.statTileLabel}>Migrations applied</Text>
                <Text style={s.statTileValue}>28</Text>
                <Text style={s.statTileCaption}>Postgres · RLS by default</Text>
              </View>
            </View>

            <View style={s.coverFootRow}>
              <View>
                <Text style={s.coverFootLabel}>Document</Text>
                <Text style={s.coverFootValue}>trendlet-almateri.pdf</Text>
              </View>
              <View>
                <Text style={s.coverFootLabel}>Status</Text>
                <Text style={s.coverFootValue}>Production · trendlet.vercel.app</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>

      {/* TOC */}
      <PageChrome pageNumber={2}>
        <Text style={s.sectionNumber}>00</Text>
        <Text style={s.sectionTitle}>Contents</Text>
        <Text style={s.sectionLead}>
          Every feature shipped on Trendslet, organised by surface area. Page references
          are sequential within this document.
        </Text>

        <View style={[s.goldRule, { marginTop: 8 }] as any} />

        {TOC_ITEMS.map((item) => (
          <View style={s.tocRow} key={item.number}>
            <Text style={s.tocNumber}>{item.number}</Text>
            <Text style={s.tocTitle}>{item.title}</Text>
            <Text style={s.tocPage}>{item.page}</Text>
          </View>
        ))}
      </PageChrome>

      {/* Sections */}
      <Section number="01" title="Identity, roles, and access control" pageNumber={3}
        lead="Five roles, JWT-injected claims, server-side route guards, and admin team management."
      >
        <Text style={s.subTitle}>Roles</Text>
        <Bullet>admin — full read/write across regions and assignees.</Bullet>
        <Bullet>sourcing — drives the buy phase for the regions they cover.</Bullet>
        <Bullet>warehouse — confirms receipt, prepares shipment, ships, marks arrived in KSA.</Bullet>
        <Bullet>fulfiller — EU end-to-end (sourcing through delivery).</Bullet>
        <Bullet>ksa_operator — last-mile in Saudi Arabia (placeholder for shipping-company integration).</Bullet>

        <Text style={s.subTitle}>Auth surface</Text>
        <Bullet>Supabase Auth with custom JWT claims hook (roles + region injected per token).</Bullet>
        <Bullet>requireRole(["sourcing", "admin"]) on every protected route.</Bullet>
        <Bullet>Admin team management at /admin/team: invite by email, activate / deactivate, pending invitations, self-deactivation guard.</Bullet>
        <Bullet>Forgot-password flow, setup-token activation for invited users.</Bullet>
      </Section>

      <Section number="02" title="Order ingestion (Shopify)" pageNumber={4}
        lead="Read-only inbound. One Shopify order produces one orders row and N sub_orders rows."
      >
        <Bullet>Webhook endpoint /api/webhooks/shopify/orders-create receives every push.</Bullet>
        <Bullet>Auto-assignment — primary brand-assignment user picks up the sub-order. Falls back to is_unassigned + pending status when no primary exists.</Bullet>
        <Bullet>Region routing — brand region (US / EU / UK / KSA) decides which role queue the sub-order lands in.</Bullet>
        <Bullet>Daily-rotating Shopify access token (24h TTL, refreshed at session start).</Bullet>
        <Bullet>Webhook deliveries logged in webhook_deliveries with payload, status, retry count — failed pushes can be replayed without re-pulling.</Bullet>
        <Bullet>Trendslet never writes back to Shopify.</Bullet>
      </Section>

      <Section number="03" title="Brands and assignments" pageNumber={5}
        lead="Per-brand fields and many-to-many user assignment drive routing and queue visibility."
      >
        <Bullet>CRUD at /admin/brands.</Bullet>
        <Bullet>Per-brand: name, region, default markup percent, primary contact, brand-assigned users.</Bullet>
        <Bullet>brand_assignments — many-to-many between brands and users; the primary assignee gets new sub-orders auto-routed to them.</Bullet>
        <Bullet>Region filter pushed into SQL via inner join — no JS-side filtering at scale.</Bullet>
      </Section>

      <Section number="04" title="Sub-order workflow" pageNumber={6}
        lead="The state machine. Every sub-order moves through a 17-status pipeline in 5 stages, governed by per-role whitelists and a DB-level enforcement trigger."
      >
        <Text style={s.subTitle}>Stages and statuses</Text>
        <View style={s.table}>
          <View style={[s.tableRow, s.tableHeaderRow] as any}>
            <Text style={[s.tableHeaderCell, { width: 80 }] as any}>Stage</Text>
            <Text style={[s.tableHeaderCell, { flex: 1 }] as any}>Statuses</Text>
          </View>
          {STAGE_TABLE.map((row) => (
            <View style={s.tableRow} key={row.stage}>
              <Text style={[s.tableCell, { width: 80, fontFamily: "Helvetica-Bold" }] as any}>{row.stage}</Text>
              <Text style={[s.tableCell, { flex: 1 }] as any}>{row.statuses}</Text>
            </View>
          ))}
        </View>

        <Text style={s.subTitle}>Engine</Text>
        <Bullet>Declarative transitions in lib/workflow/sub-order-transitions.ts.</Bullet>
        <Bullet>Linear with branches at the "purchased" stage and the "delivered to warehouse" decision point.</Bullet>
        <Bullet>Per-role whitelist in lib/constants.ts mirrored by statuses.allowed_from_roles.</Bullet>
        <Bullet>DB trigger enforce_status_whitelist is the security boundary — auto-fills status_changed_by and uses jwt_is_admin() for admin bypass.</Bullet>
        <Bullet>Optimistic UI via React useOptimistic; auto-revert on server error.</Bullet>
        <Bullet>Every transition recorded in activity_log with actor, before, after, timestamp.</Bullet>
        <Bullet>Risk and delay flags (is_at_risk, is_delayed) auto-set against per-status SLA targets.</Bullet>
      </Section>

      <Section number="05" title="Role views" pageNumber={7}
        lead="Three queue surfaces, all backed by one shared fetch. Each role only sees what it can act on."
      >
        <Text style={s.subTitle}>Sourcing — /queue</Text>
        <Bullet>US sub-orders for brands assigned to the user.</Bullet>
        <Bullet>Tabs: To do (pre-purchase) · In progress (purchased) · Completed (read-only, delivered to warehouse onward).</Bullet>
        <Bullet>Actions: Start sourcing · Mark purchased · Out of stock · Hand off to warehouse · Cancel.</Bullet>
        <Bullet>Per-row receipt upload (PDF), brand filter, sort by newest / oldest.</Bullet>

        <Text style={s.subTitle}>Warehouse — /pipeline</Text>
        <Bullet>US sub-orders at warehouse stage.</Bullet>
        <Bullet>Actions: Confirm receipt · Mark preparing · Mark shipped · Mark arrived in KSA.</Bullet>
        <Bullet>Trimmed permissions — out_for_delivery and delivered are not warehouse's.</Bullet>

        <Text style={s.subTitle}>EU Fulfiller — /fulfillment</Text>
        <Bullet>EU sub-orders for brands assigned to the user.</Bullet>
        <Bullet>Broadest action set — covers sourcing and warehouse responsibilities for EU.</Bullet>

        <Text style={s.subTitle}>KSA last-mile — /deliveries</Text>
        <Bullet>KSA sub-orders at arrived_in_ksa onward.</Bullet>
        <Bullet>Actions: Out for delivery · Delivered · Returned.</Bullet>

        <Text style={s.subTitle}>Admin</Text>
        <Bullet>Sees everything across regions and assignees, all transitions allowed.</Bullet>
      </Section>

      <Section number="06" title="Supplier invoices and AI extraction" pageNumber={8}
        lead="Sourcers upload supplier receipts, AI extracts line items, line items map to sub-orders, and customer invoice drafts are computed automatically."
      >
        <Text style={s.subTitle}>Upload</Text>
        <Bullet>Drag-drop PDF onto a sub-order row in /queue or /fulfillment.</Bullet>
        <Bullet>Magic-byte server-side PDF check.</Bullet>
        <Bullet>Storage in supplier-invoices Supabase bucket; sub_order_supplier_invoices junction supports many-to-many (one PDF, multiple sub-orders).</Bullet>
        <Bullet>Ownership check — only the assignee can upload to their sub-orders. Warehouse role excluded.</Bullet>

        <Text style={s.subTitle}>AI extraction</Text>
        <Bullet>OpenRouter vision model parses the PDF.</Bullet>
        <Bullet>Extracts item name, price, quantity, currency.</Bullet>
        <Bullet>Mock fallback when OPENROUTER_API_KEY is not set — full UI flow still works without credits burning.</Bullet>
        <Bullet>Admin chooses the OCR model on /admin/invoice-settings.</Bullet>

        <Text style={s.subTitle}>Mapping → drafts</Text>
        <Bullet>Per-line dropdown maps each extracted line to a sub-order.</Bullet>
        <Bullet>"Create customer invoice drafts" button computes per group: cost (multi-currency), FX → SAR, brand markup, shipping, VAT 15 percent, total.</Bullet>
        <Bullet>Writes customer_invoices rows in pending_review status.</Bullet>
      </Section>

      <Section number="07" title="Customer invoices" pageNumber={9}
        lead="Review, approve, and send invoices to the end customer."
      >
        <Text style={s.subTitle}>Review surface (/invoices)</Text>
        <Bullet>Three tabs: Pending review · Approved · Sent.</Bullet>
        <Bullet>Stats strip — Awaiting count, average review time, AI accuracy 30d, pending value (SAR).</Bullet>
        <Bullet>Per-invoice card surfaces line items and the calculation breakdown.</Bullet>
        <Bullet>Low-confidence flag when AI extraction confidence is below threshold; per-line warnings on unusual pricing.</Bullet>

        <Text style={s.subTitle}>Per-invoice actions</Text>
        <Bullet>Approve and send — locks the invoice, queues outbound email.</Bullet>
        <Bullet>Edit prices — manual override before approval.</Bullet>
        <Bullet>Preview PDF — server-side render of the final document.</Bullet>
        <Bullet>Reject — back to draft.</Bullet>

        <Text style={s.subTitle}>Outbound (Zoho Mail)</Text>
        <Bullet>Server-rendered invoice PDF (this same generator family) attached.</Bullet>
        <Bullet>From-address per ZOHO_FROM_ADDRESS; mock-mode fallback when creds are missing.</Bullet>
      </Section>

      <Section number="08" title="Zoho inbound polling" pageNumber={10}
        lead="Some suppliers email receipts directly. The system polls Zoho Mail for incoming attachments and feeds them into the same extraction pipeline."
      >
        <Bullet>Daily cron 05:00 UTC at /api/cron/poll-zoho-inbound (Hobby plan limits to daily; hourly on Pro).</Bullet>
        <Bullet>Admin "Poll now" button on /admin/invoice-settings with recent-imports list.</Bullet>
        <Bullet>Dedup via zoho_inbound_messages — message_id tracker prevents double-imports.</Bullet>
        <Bullet>supplier_invoices.uploaded_by is nullable when source != 'manual'.</Bullet>
      </Section>

      <Section number="09" title="AI barcode reading" pageNumber={11}
        lead="Some supplier receipts barcode the supplier's order ID. Trendslet reads it and surfaces it for cross-reference."
      >
        <Bullet>Vision-model prompt asks specifically for human-readable digits under barcode bars.</Bullet>
        <Bullet>validateBarcode() rejects hallucinations: length 6–30, no all-zeros, no obvious garbage.</Bullet>
        <Bullet>Read barcode is shown in the mapping panel header.</Bullet>
      </Section>

      <Section number="10" title="Logistics surfaces" pageNumber={12}
        lead="Outbound packages, last-mile, and returns each have their own surface — all backed by the same sub-order state machine."
      >
        <Bullet>/shipments — outbound package list with tracking numbers.</Bullet>
        <Bullet>/deliveries — KSA last-mile queue.</Bullet>
        <Bullet>/returns — returned packages handling.</Bullet>
        <Bullet>SLA-aware — late shipments surface in dashboards and trigger notifications.</Bullet>
      </Section>

      <Section number="11" title="SLA, team load, and reporting" pageNumber={13}
        lead="Operational visibility for admin and team leads."
      >
        <Text style={s.subTitle}>SLA — /sla-health</Text>
        <Bullet>Per-status SLA targets in statuses.sla_hours.</Bullet>
        <Bullet>Per-brand, per-assignee, per-region compliance views.</Bullet>
        <Bullet>Materialized views (mv_*) aggregate metrics; refreshed via pg_cron.</Bullet>

        <Text style={s.subTitle}>Team load — /team-load</Text>
        <Bullet>Per-assignee active workload count and average time-in-status.</Bullet>
        <Bullet>Dashboard widget shows the same data summarised as percentage-capacity bars per role group.</Bullet>

        <Text style={s.subTitle}>Reports — /reports</Text>
        <Bullet>Admin reports surface (placeholder filling in as needs are scoped).</Bullet>
        <Bullet>Aggregations live in materialized views, not in app-layer SQL.</Bullet>
      </Section>

      <Section number="12" title="Hubstaff & payroll" pageNumber={14}
        lead="Time tracking flows in daily and surfaces in payroll."
      >
        <Bullet>Daily cron 04:00 UTC at /api/cron/pull-hubstaff.</Bullet>
        <Bullet>Stored in payroll table, reviewed by admin at /payroll.</Bullet>
      </Section>

      <Section number="13" title="Notifications and realtime" pageNumber={15}
        lead="Status changes, SLA breaches, and new assignments flow via Supabase Realtime channels."
      >
        <Bullet>In-app realtime notifications panel in the top bar with unread badge.</Bullet>
        <Bullet>notifications_archive holds the historical record.</Bullet>
        <Bullet>Per-user channels (desktop + mobile).</Bullet>
        <Bullet>Triggered by status changes, SLA breaches, new assignments, invoice approvals.</Bullet>
      </Section>

      <Section number="14" title="Mobile, offline, i18n" pageNumber={16}
        lead="The team uses this on phones in warehouses; the system is built for it."
      >
        <Bullet>Bottom nav for mobile, sidebar drawer with full nav tree, mobile top bar with notifications and search.</Bullet>
        <Bullet>Service worker registered — basic offline shell so the operator app loads on a flaky network.</Bullet>
        <Bullet>Bilingual UI hooks with EN | عربي toggle in the top bar.</Bullet>
        <Bullet>RTL layout partial — full Arabic locale work parked.</Bullet>
      </Section>

      <Section number="15" title="Database" pageNumber={17}
        lead="Postgres on Supabase. RLS by default, JWT-aware admin checks, 28 migrations applied."
      >
        <Bullet>Project kfrjqpjprvvsibwmrqph in eu-west-1 (Supabase Hobby).</Bullet>
        <Bullet>28 migrations across extensions, enums, core tables, dependent tables, views, materialized views, search functions, triggers, RLS policies, column-level isolation, storage buckets, JWT custom claims hook, pg_cron schedules.</Bullet>
        <Bullet>Every table has RLS; admin operations use a service-role client when bypass is justified.</Bullet>
        <Bullet>jwt_is_admin() is the only admin check function (the legacy is_admin() was removed everywhere).</Bullet>
      </Section>

      <Section number="16" title="Storage and assets" pageNumber={18}
        lead="Supabase buckets for the two PDF surfaces."
      >
        <Bullet>supplier-invoices bucket — supplier PDFs uploaded by sourcers.</Bullet>
        <Bullet>customer-invoices bucket — generated customer invoice PDFs.</Bullet>
        <Bullet>Storage policies are JWT-admin aware: uploaders write to their own scoped paths, admins read everything.</Bullet>
      </Section>

      <Section number="17" title="Background jobs" pageNumber={19}
        lead="Daily cron jobs and pg_cron-driven view refreshes."
      >
        <View style={s.table}>
          <View style={[s.tableRow, s.tableHeaderRow] as any}>
            <Text style={[s.tableHeaderCell, { width: 110 }] as any}>Schedule</Text>
            <Text style={[s.tableHeaderCell, { flex: 1 }] as any}>Job</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.tableCell, { width: 110 }] as any}>04:00 UTC daily</Text>
            <Text style={[s.tableCell, { flex: 1 }] as any}>/api/cron/pull-hubstaff — pull time tracking into payroll.</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.tableCell, { width: 110 }] as any}>05:00 UTC daily</Text>
            <Text style={[s.tableCell, { flex: 1 }] as any}>/api/cron/poll-zoho-inbound — fetch supplier emails with attachments.</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.tableCell, { width: 110 }] as any}>pg_cron</Text>
            <Text style={[s.tableCell, { flex: 1 }] as any}>Materialized view refresh (non-concurrent — mv_* lack unique indexes).</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.tableCell, { width: 110 }] as any}>pg_cron</Text>
            <Text style={[s.tableCell, { flex: 1 }] as any}>Per-status SLA computation feeding is_at_risk and is_delayed flags.</Text>
          </View>
        </View>
      </Section>

      <Section number="18" title="Integrations" pageNumber={20}
        lead="External services Trendslet talks to."
      >
        <View style={s.table}>
          <View style={[s.tableRow, s.tableHeaderRow] as any}>
            <Text style={[s.tableHeaderCell, { width: 90 }] as any}>Service</Text>
            <Text style={[s.tableHeaderCell, { width: 130 }] as any}>Purpose</Text>
            <Text style={[s.tableHeaderCell, { flex: 1 }] as any}>Status</Text>
          </View>
          {INTEGRATIONS.map((row) => (
            <View style={s.tableRow} key={row.service}>
              <Text style={[s.tableCell, { width: 90, fontFamily: "Helvetica-Bold" }] as any}>{row.service}</Text>
              <Text style={[s.tableCell, { width: 130 }] as any}>{row.purpose}</Text>
              <Text style={[s.tableCell, { flex: 1 }] as any}>{row.status}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section number="19" title="Deployment and ops" pageNumber={21}
        lead="Vercel-hosted, GitHub-deployed, JWT-secured."
      >
        <Bullet>Hosted on Vercel — project owner ai@trendlet.com, auto-deploy on push to main.</Bullet>
        <Bullet>GitHub repo at github.com/trendlet-almateri/trendlet.</Bullet>
        <Bullet>No middleware — Edge runtime can't bundle @supabase/ssr; auth gating lives in server-component layouts.</Bullet>
        <Bullet>Vercel Deployment Protection (SSO) ON — public visitors hit the auth wall until signed in.</Bullet>
        <Bullet>Hobby-plan constraints: daily-only crons; commit author must be a project member (ai@trendlet.com).</Bullet>
      </Section>

      <Section number="20" title="Roadmap (parked)" pageNumber={22}
        lead="Known and intentional — not yet shipped, with reason."
      >
        <Bullet>Cancel-from-any-state UI — workflow comments hint at it; UI not yet built.</Bullet>
        <Bullet>Sync-badge accuracy — currently hardcoded "Synced 2 min ago" on dashboard and invoice list.</Bullet>
        <Bullet>Lighthouse a11y final pass — deferred to pre-launch QA.</Bullet>
        <Bullet>Real Shopify webhook in production — currently [TEST]-prefixed seed data only.</Bullet>
        <Bullet>Full Arabic locale and RTL polish — separate phase.</Bullet>
        <Bullet>Pro-plan hourly crons — pending plan upgrade.</Bullet>
        <Bullet>Schema for priority, target_cost, supplier_type, internal_note on sub_orders — locked design but data flow not yet decided.</Bullet>
      </Section>

      <Section number="21" title="Operating constraints" pageNumber={23}
        lead="Things baked into the system that future contributors should know."
      >
        <Bullet>15 status keys live in DB; unassigned is NOT one of them — it's a boolean flag (is_unassigned) plus a real status (typically pending).</Bullet>
        <Bullet>@supabase/supabase-js pinned to ~2.46.2 — newer breaks type narrowing in @supabase/ssr@0.5.2.</Bullet>
        <Bullet>Test-data marker: [TEST] prefix on product titles + _mock=true in raw_payload. Single-statement cleanup before launch.</Bullet>
        <Bullet>Vercel Hobby author rule: every commit must come from ai@trendlet.com or the deploy fails.</Bullet>
        <Bullet>The (app) route group's layout is force-dynamic — propagates to children. Page-level revalidate is cosmetic until the layout is restructured.</Bullet>
      </Section>

      {/* Closing */}
      <PageChrome pageNumber={24}>
        <Text style={s.sectionNumber}>—</Text>
        <Text style={s.sectionTitle}>End of document</Text>
        <Text style={s.sectionLead}>
          This document is generated from the in-repo feature inventory. It will drift if
          the source diverges; regenerate by running scripts/generate-overview-pdf.mjs.
        </Text>
        <View style={[s.goldRule, { marginTop: 20 }] as any} />
        <Text style={[s.paragraph, { marginTop: 16 }] as any}>
          Trendslet · by Almateri · trendlet.vercel.app
        </Text>
      </PageChrome>
    </Document>
  );
};

const TOC_ITEMS = [
  { number: "01", title: "Identity, roles, and access control",         page: 3 },
  { number: "02", title: "Order ingestion (Shopify)",                   page: 4 },
  { number: "03", title: "Brands and assignments",                      page: 5 },
  { number: "04", title: "Sub-order workflow",                          page: 6 },
  { number: "05", title: "Role views",                                  page: 7 },
  { number: "06", title: "Supplier invoices and AI extraction",         page: 8 },
  { number: "07", title: "Customer invoices",                           page: 9 },
  { number: "08", title: "Zoho inbound polling",                        page: 10 },
  { number: "09", title: "AI barcode reading",                          page: 11 },
  { number: "10", title: "Logistics surfaces",                          page: 12 },
  { number: "11", title: "SLA, team load, and reporting",               page: 13 },
  { number: "12", title: "Hubstaff & payroll",                          page: 14 },
  { number: "13", title: "Notifications and realtime",                  page: 15 },
  { number: "14", title: "Mobile, offline, i18n",                       page: 16 },
  { number: "15", title: "Database",                                    page: 17 },
  { number: "16", title: "Storage and assets",                          page: 18 },
  { number: "17", title: "Background jobs",                             page: 19 },
  { number: "18", title: "Integrations",                                page: 20 },
  { number: "19", title: "Deployment and ops",                          page: 21 },
  { number: "20", title: "Roadmap (parked)",                            page: 22 },
  { number: "21", title: "Operating constraints",                       page: 23 },
];

const STAGE_TABLE = [
  { stage: "Pending",   statuses: "pending · assigned · unassigned" },
  { stage: "Sourcing",  statuses: "under_review · in_progress · purchased_online · purchased_in_store · out_of_stock" },
  { stage: "Warehouse", statuses: "delivered_to_warehouse · preparing_for_shipment" },
  { stage: "Shipping",  statuses: "shipped · arrived_in_ksa · out_for_delivery" },
  { stage: "Terminal",  statuses: "delivered · returned · cancelled · failed" },
];

const INTEGRATIONS = [
  { service: "Shopify",    purpose: "Order ingestion (read-only)",                    status: "Wired (test data in production today, real webhook pending)" },
  { service: "Supabase",   purpose: "Postgres + Auth + Storage + Realtime",            status: "Live" },
  { service: "OpenRouter", purpose: "AI extraction (vision OCR + barcode)",            status: "Configurable; mock-mode fallback when key absent" },
  { service: "Zoho Mail",  purpose: "Outbound invoices + inbound supplier polling",    status: "Configurable; mock-mode fallback when creds absent" },
  { service: "Hubstaff",   purpose: "Time tracking → payroll",                         status: "Wired (daily cron)" },
  { service: "Vercel",     purpose: "Hosting + cron + auto-deploy",                    status: "Hobby plan (daily-cron limit)" },
];

/* ── public render fn ──────────────────────────────────────────────── */

/**
 * Render the overview document and return a Node Buffer.
 * Used by scripts/generate-overview-pdf.mjs.
 */
export async function renderTrendletOverviewPdf(): Promise<Buffer> {
  const blob = await pdf(<TrendletOverviewDocument />).toBlob();
  const arrayBuf = await blob.arrayBuffer();
  return Buffer.from(arrayBuf);
}
