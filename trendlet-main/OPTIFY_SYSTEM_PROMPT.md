# Optify OMS — Complete System Specification

> **Purpose:** This document is the single source of truth for building Optify (Trendslet's Order Management System). It contains every design decision, page specification, component pattern, and architectural rule agreed upon during the design phase. Use this as the master prompt for Lovable, Cursor, Claude Code, or any AI coding assistant.

---

## Table of Contents

1. [Project overview](#1-project-overview)
2. [Tech stack](#2-tech-stack)
3. [Design system](#3-design-system)
4. [Layout architecture](#4-layout-architecture)
5. [Authentication & access](#5-authentication--access)
6. [Roles & permissions](#6-roles--permissions)
7. [Page-by-page specification](#7-page-by-page-specification)
8. [Component library](#8-component-library)
9. [Responsive behavior](#9-responsive-behavior)
10. [Notifications system](#10-notifications-system)
11. [Integration specs](#11-integration-specs)
12. [Security model](#12-security-model)
13. [MVP scope vs future](#13-mvp-scope-vs-future)
14. [Performance & operational quality](#14-performance--operational-quality)
15. [Build instructions](#15-build-instructions)

---

## 1. Project overview

### What Optify is

Optify is an internal Order Management System (OMS) for **Trendslet**, a Saudi Arabian e-commerce business that sells international fashion and lifestyle brands to KSA customers. Optify sits downstream of Shopify and orchestrates the entire post-purchase workflow: sourcing the product from international suppliers, shipping it to a US/EU warehouse, bulk-shipping to Saudi Arabia, and last-mile delivery in KSA.

**Core principle:** Shopify is the inbox. Optify is the operational spine. Optify reads from Shopify but never writes back to it.

### Business model

- Customer buys on Shopify (Trendslet store) at a markup price.
- Optify auto-receives the order, splits it per brand (one sub-order per line item).
- Each sub-order auto-routes to the employee assigned to that brand.
- Employee buys from supplier, ships to warehouse, warehouse packs and ships internationally, KSA team handles last-mile.
- Customer receives WhatsApp notifications at every status change.
- Admin generates customer invoice (cost + markup + shipping + VAT), reviews AI-drafted invoices before sending.

### Geographical structure

- **United States team:** Sourcing employees + Warehouse employees (separate roles).
- **European Union team:** Fulfiller (single role doing both sourcing and warehouse for EU brands).
- **Saudi Arabia team:** KSA Last-mile Operator (handles delivery in Riyadh and other cities).
- **Admin:** Can be located anywhere; oversees everything.

### Operating constraints

- All admin/employee interfaces are **English-only**.
- Customer-facing content (PDF invoices, WhatsApp messages) supports **English / Arabic / Bilingual** based on uploaded invoice template language.
- The system must be **multi-store ready** even though Trendslet currently operates one store.
- The system must be **multi-currency** — every order, sub-order, and invoice carries an explicit currency. There is **no currency conversion**; each currency displays standalone.
- All system data is private; no public-facing pages except a login screen.

---

## 2. Tech stack

### Required stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14+ App Router | Server components, server actions, streaming |
| Language | TypeScript (strict mode) | All files `.ts` / `.tsx` |
| Database | Supabase (Postgres 15) | RLS-first, realtime, storage, edge functions |
| Auth | Supabase Auth | Email + password, no signup, no SSO |
| Hosting | Vercel | Auto-deploy on push to main; **must be Pro plan** (not Hobby — 10s timeout limits, ToS) |
| UI primitives | shadcn/ui on Radix | Accessible, composable |
| Forms | react-hook-form + Zod | Type-safe validation |
| Styling | Tailwind CSS | Utility-first |
| Icons | Lucide React | Consistent icon library |
| AI (deferred) | Vercel AI SDK | Mock today, real LLM when business approves |
| Realtime | Supabase Realtime | For notifications, status updates |

### Mandatory packages

```json
{
  "@supabase/ssr": "latest",
  "@supabase/supabase-js": "latest",
  "next": "^14",
  "react": "^18",
  "tailwindcss": "^3",
  "lucide-react": "latest",
  "react-hook-form": "latest",
  "zod": "latest",
  "@hookform/resolvers": "latest",
  "date-fns": "latest",
  "recharts": "latest",
  "sonner": "latest",
  "@tanstack/react-query": "latest",
  "@tanstack/react-virtual": "latest",
  "idb": "latest",
  "zustand": "latest"
}
```

### File structure (App Router)

```
app/
  (auth)/
    login/
      page.tsx
    forgot-password/
      page.tsx
    setup/
      [token]/
        page.tsx           # invitation acceptance
  (admin)/
    layout.tsx             # requireRole('admin')
    dashboard/
      page.tsx
    orders/
      page.tsx
      [id]/
        page.tsx
      unassigned/
        page.tsx
    invoices/
      page.tsx
      [id]/
        page.tsx
    shipments/
      page.tsx
    returns/
      page.tsx
    sourcing/
      page.tsx             # admin team view
    warehouse/
      page.tsx
    eu-fulfillment/
      page.tsx
    ksa-last-mile/
      page.tsx
    sla-health/
      page.tsx
    team-load/
      page.tsx
    payroll/
      page.tsx
    reports/
      page.tsx
    activity-log/
      page.tsx
  (employee)/
    layout.tsx             # requireRole(['sourcing', 'warehouse', 'fulfiller', 'ksa_operator'])
    queue/
      page.tsx             # sourcing/fulfiller default
    pipeline/
      page.tsx             # warehouse default
    deliveries/
      page.tsx             # ksa_operator default
    upload-invoice/
      page.tsx
    history/
      page.tsx
  api/
    webhooks/
      shopify/
        orders-create/
          route.ts
        orders-updated/
          route.ts
    cron/
      pull-hubstaff/
        route.ts
      shopify-poll-fallback/
        route.ts
components/
  ui/                       # shadcn primitives
  layout/
    Sidebar.tsx
    PageHeader.tsx
    UserDropdown.tsx
    NotificationsPanel.tsx
    CommandPalette.tsx
  shared/
    StatusBadge.tsx
    StatusSummaryBar.tsx
    Avatar.tsx
    EmptyState.tsx
    DataTable.tsx
  invoices/
    InvoiceCard.tsx
    InvoiceCalculation.tsx
    AIReasoningPanel.tsx
  orders/
    OrderRow.tsx
    SubOrderRow.tsx
    OrderFiltersBar.tsx
lib/
  supabase/
    server.ts
    client.ts
    middleware.ts
  api-client.ts            # centralized external API wrapper
  auth/
    requireRole.ts
    getCurrentUser.ts
  utils/
    currency.ts
    phone.ts               # Saudi phone normalization
    invoice-number.ts
    fuzzy-match.ts         # for brand name matching
  constants.ts
  types.ts
middleware.ts              # session refresh
```

---

## 3. Design system

### Design philosophy

**"Operational Elegance"** — clean, professional, navy-based, dense enough for 8-hour workdays without visual fatigue. Inspired by Linear, Notion, and Stripe Dashboard. Premium feel through restraint, not decoration.

### Color palette

**Primary brand:**
- Navy primary: `#0C447C` (active states, primary buttons)
- Navy deep: `#042C53` (dark surfaces, "Total" cards)
- Brand accent: `#E24B4A` (Trendslet logo only)

**Backgrounds:**
- Page: `#F5F5F7` (slight cool-gray)
- Surface: `#FFFFFF` (cards)
- Sidebar: `#1A1A1A` (frame dark)
- Sidebar item active: `rgba(55, 138, 221, 0.15)` with text `#B5D4F4`

**Status colors (semantic, used everywhere):**
| State | Background | Text | Border |
|---|---|---|---|
| Sourcing | `#FAEEDA` | `#633806` | `#EF9F27` |
| Warehouse | `#E6F1FB` | `#0C447C` | `#378ADD` |
| In transit | `#EEEDFE` | `#3C3489` | `#7F77DD` |
| Delivered | `#E1F5EE` | `#085041` | `#1D9E75` |
| Pending | `#F1EFE8` | `#2C2C2A` | `#888780` |
| Danger / Urgent | `#FCEBEB` | `#791F1F` | `#F09595` |
| Success / On-time | `#E1F5EE` | `#0F6E56` | `#5DCAA5` |

**Text:**
- Primary: `#171717`
- Secondary: `#525252`
- Tertiary: `#737373`

**Borders:**
- Default: `rgba(0,0,0,0.08)` (0.5px lines)
- Strong: `rgba(0,0,0,0.15)` (hover, focus)

### Typography

**Font family:** Inter or Geist Sans (sans-serif, no serif anywhere — keeps it operational).
**Font weights used:** 400 (regular), 500 (medium/bold). **Never 600 or 700.**

**Type scale:**
- Page heading (h1): 20px / weight 500
- Section heading (h2): 16px / weight 500
- Card title: 13px / weight 500
- Body: 13px / weight 400
- Label / metadata: 11px / weight 500
- Tertiary / hint: 10px / weight 400 / uppercase letter-spacing 0.4px

**Sentence case everywhere.** Never Title Case, never ALL CAPS (except short uppercase labels with letter-spacing).

### Spacing

Base unit: **4px**. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48.

- Card padding: 14–16px
- Section gap: 12px
- Between cards: 8–10px
- Form field margin: 14px

### Border radius

- Small (badges, inputs): 4px
- Medium (cards, buttons): 5–6px
- Large (modals, hero cards): 8–12px

### Shadows

**Avoid shadows in normal UI.** Use them only for:
- Modal overlays: `0 8px 24px rgba(0,0,0,0.12)`
- Notification dropdown: `0 8px 24px rgba(0,0,0,0.08)`
- Login card: `0 4px 16px rgba(0,0,0,0.04)`

No drop shadows on regular cards. Use 0.5px borders instead.

### Iconography

Use **Lucide React** consistently. Common icons:
- Bell (notifications)
- Search
- Settings
- ChevronDown / ChevronUp / ChevronRight
- Plus / X (close)
- AlertCircle (danger)
- AlertTriangle (warning)
- CheckCircle (success)
- Info
- ArrowRight (CTAs)

Icon sizes: 14px (inline), 16px (buttons), 20px (page actions).

---

## 4. Layout architecture

### Global layout (no topbar)

The system uses a **sidebar-only** layout. There is **no separate topbar**. Inspired by Linear.

```
┌──────────┬──────────────────────────────────────────┐
│          │  [Search ⌘K]  [🔔 3]  [EN]              │ ← page-level utility bar
│ SIDEBAR  ├──────────────────────────────────────────┤
│  (dark)  │                                          │
│          │  [Page content]                          │
│          │                                          │
│          │                                          │
│          │                                          │
│  [User]  │                                          │
└──────────┴──────────────────────────────────────────┘
```

### Sidebar (dark — `#1A1A1A`)

**Width:** 220px on desktop, collapsible to icons-only on tablet, hidden on mobile (replaced by bottom navigation).

**Top section (store header):**
- Trendslet logo (red square with "T") + "Trendslet" / "Main store" subtitle
- **No Unassigned alert here** — alerts live in the bell notifications

**Sidebar sections (3 groups):**

1. **Workspace**
   - Dashboard (active state)
   - Orders (1,284)
   - Invoices (42)
   - Shipments
   - Returns (14)

2. **Operations**
   - 🟡 Sourcing (8)
   - 🔵 Warehouse (12)
   - 🟣 EU fulfillment (5)
   - 🟢 KSA last-mile (7)
   
   Each item has a 6px colored dot matching its workflow stage.

3. **Insights**
   - SLA health
   - Team load
   - Payroll
   - Reports

**Bottom (fixed):**
- User chip: avatar (30px navy square) + name + role + ▴ caret. Clicking opens the user dropdown.

### Page-level utility bar

A single horizontal row at the top-right of the content area (NOT a topbar). Contains only:

1. **Search box** (left of right cluster) — 280px max width, white card with 🔍 icon, "Search…" placeholder, and `⌘K` keyboard hint pill on the right.
2. **Bell icon** — white card with red dot indicator if unread notifications exist. Clicking opens Notifications panel.
3. **Language indicator** — white card showing "EN" with "| عربي" muted (clickable but doesn't switch the dashboard — admin/employee dashboards are always English; this is informational/future).

**Page heading** (e.g., "Dashboard") is on the left side of the content area, NOT in the utility bar. Subtitle and date stamps are removed (the user explicitly requested this).

### User dropdown (dark, premium)

Triggered by clicking the user chip at the bottom of the sidebar. Opens upward.

Dark background (`#2A2A2A`), 320px wide, with 4 sections:

1. **Profile header** (no section label):
   - 40px circle avatar
   - Full name (white, 14px / 500)
   - email + role (muted)

2. **ACCOUNT**
   - Profile & presence (with green "Online" indicator on the right)
   - My preferences (with "EN · SAR" or whatever is configured)

3. **QUEUE** (with red highlight if items > 0):
   - Unassigned sub-orders (red card if count > 0, with badge showing count)

4. **WORKSPACE SETUP**
   - Stores (2 active)
   - Brands & assignments (11 brands)
   - Team & roles (5 members)
   - Carriers (3 active)
   - Integrations (4 active)
   - Security (2FA on)

5. **Sign out** (red text, with logout icon)

Each item has a small icon on the left and metadata count on the right.

---

## 5. Authentication & access

### Login page

**Layout:** Single centered card on a light gray (`#F5F5F7`) background. NOT split-screen (the user explicitly removed the right-side marketing showcase).

**Card specs:**
- White background, 380px max width
- 0.5px border, 12px radius
- 40px / 44px padding
- Subtle shadow: `0 4px 16px rgba(0,0,0,0.04)`

**Card contents (top to bottom):**
1. Logo + "Trendslet" / "Operations Console" (32px gap below)
2. "Welcome back" heading (22px / 500)
3. "Sign in to manage orders, invoices, and operations." subtitle
4. Email field (label + input)
5. Password field (label with "Forgot password?" link on the right + input)
6. "Keep me signed in for 30 days" checkbox
7. **Sign in →** button (full width, navy `#042C53`)
8. Info banner (gray card): "i Access is invite-only. Contact your admin if you need an account."
9. Footer (top-bordered): "© 2026 Optify · Powered by Optify.cc" + "Privacy / Help" links

**Critical rules:**
- ❌ No "Sign up" link anywhere
- ❌ No Google SSO (security-first)
- ❌ No language toggle (English-only dashboard)
- ❌ No social proof, no marketing content
- ✅ Forgot password link exists (`/forgot-password`)
- ✅ Invite-only enforced — accounts created only by admin

### Invitation flow

1. **Admin invites:** From user dropdown → "Team & roles" → "+ Invite member". Form fields:
   - Email
   - Full name
   - Role(s) — multi-select (admin, sourcing, warehouse, fulfiller, ksa_operator)
   - Region (US / EU / KSA / —)
   - Optional: ship-from address

2. **Email sent:** Subject "You've been invited to join Trendslet Operations". Body: simple HTML with Trendslet branding + "Accept invitation" CTA button. Token-based link, 7-day expiry.

3. **Invitee clicks link:** Opens `/setup/[token]` page:
   - "Set up your account"
   - Confirms email (read-only)
   - Sets password (twice, with strength indicator)
   - Accepts terms checkbox
   - "Create account" button

4. **Redirect to login:** They sign in normally. First sign-in flags them as "active" in profiles table.

### Multi-role users

The system supports many-to-many `users ↔ roles`. A user who is both Sourcing and Warehouse (e.g., a small US team member) sees both sections in their navigation.

**Per the user's explicit request: NO role switcher modal on login.** If a user has multiple roles, they see all relevant pages in their nav simultaneously. The pages auto-detect role context from the route path.

### Session management

- HttpOnly cookies (Supabase Auth default)
- Session refreshed by middleware on each request
- "Keep me signed in for 30 days" extends refresh token
- Logout is POST-only (CSRF-hardened) at `/api/auth/logout`

### Password reset

`/forgot-password` page:
- Single email input
- "Send reset link" button
- After submit: confirmation message ("If this email exists, you'll receive a reset link")
- Reset link goes to `/reset-password/[token]`

---

## 6. Roles & permissions

### Role definitions

| Role | Region | Primary task | Sees prices? |
|---|---|---|---|
| `admin` | Any | Full system control, invoice approval, user management | ✅ Yes |
| `sourcing` | US | Buy items from suppliers, upload supplier invoices | ❌ No |
| `warehouse` | US | Receive, pack, ship bulk outbound | ❌ No |
| `fulfiller` | EU | Combined sourcing + warehouse for EU brands | ❌ No |
| `ksa_operator` | — | Receive bulk in KSA, last-mile delivery | ❌ No |

### Status whitelist per role

Each role can only set certain statuses on a sub-order. Admin bypasses all restrictions.

| Role | Allowed statuses to set |
|---|---|
| `sourcing` | `under_review`, `in_progress`, `purchased_online`, `purchased_in_store`, `out_of_stock`, `cancelled` |
| `warehouse` | `delivered_to_warehouse`, `preparing_for_shipment`, `shipped` |
| `fulfiller` | All sourcing + all warehouse statuses |
| `ksa_operator` | `arrived_in_ksa`, `out_for_delivery`, `delivered`, `returned` |
| `admin` | Any of the 15 statuses |

### Pricing isolation (CRITICAL)

Non-admin roles **must never see**:
- `unit_price`, `subtotal`, `total`, `currency` (on orders/sub-orders)
- `cost`, `item_price`, `shipment_fee`, `tax`, `total`, `profit_amount` (on customer_invoices)
- `unit_price`, `line_total`, `invoice_total` (on supplier invoices)

Implementation:
- Pricing columns are `REVOKE`d from non-admin Postgres roles
- Employees query through pricing-stripped views (e.g., `v_sub_orders_employee`)
- Admin queries tables directly via service-role client (server-side only)

---

## 7. Page-by-page specification

### 7.1 Admin Dashboard (`/dashboard`)

**Purpose:** At-a-glance health of the entire operation.

**Top of page:** Page heading "Dashboard" on the left. NO subtitle, NO date stamp.

**Sections (top to bottom):**

1. **Top KPI row** (5 cards in horizontal grid):
   - Total orders (1,284) with growth %
   - Active (612) with stage count
   - Delayed (47, RED) with at-risk count
   - Completed (625) with on-time %
   - Gross processed (SAR 1.8M) — **navy dark card**, white text — visually highlighted as the headline number

2. **Team load section** (4 cards):
   - One card per team: Sourcing, Warehouse, EU fulfillment, KSA last-mile
   - Each card: top border colored by team color, team name, member count, big number (items to do), description, progress bar showing load %
   - Used by admin to spot bottlenecks

3. **Filters row:** All / Active / Delayed / Done tabs + view toggle (Table / Pipeline)

4. **Filter chips bar:** Search, Status, Brand, Assignee, Region filters

5. **Orders table:**
   - Columns: ☐ | Order | Customer | Sub-orders | Status summary | Total | Alerts
   - Each row expandable to show sub-orders within
   - Status summary uses the multi-color progress bar pattern (see Component library)
   - Rows with urgent alerts have red border-left

6. **Pagination:** Footer with "Showing 1–25 of 1,284" and page numbers

### 7.2 Orders page (`/orders`)

Same layout as Dashboard's order section, but full page (no KPIs above). Two view modes:

**Table view (default):**
- Sortable columns
- Bulk select with checkbox
- Inline status dropdown for admin
- Expandable rows showing sub-orders

**Pipeline view (Kanban):**
- 6 columns: Pending | In progress | Purchased | Warehouse | Shipping | Delivered
- Each column shows cards: order ID, sub-order ID, product name, brand, assignee, price (admin only)
- Cards with issues get a red badge ("Delayed", "No owner", "Out of stock")
- Cards draggable between columns (admin only)
- Empty cells get red border if "No owner" badge is present

### 7.3 Order detail (`/orders/[id]`)

- Breadcrumb: Orders / ORD-48210
- Order header: ORD number + customer info + total + status badges
- Sub-orders list (expandable cards)
- Customer info card (right side)
- Status history timeline
- Action bar: change status, add note, contact customer

### 7.4 Unassigned Queue (`/orders/unassigned`)

**Purpose:** Sub-orders whose brand has no employee assigned. Action required.

**Header:** Breadcrumb "Orders / Unassigned queue", title with red "X waiting" pill, subtitle, two buttons: "Settings" and **"Auto-assign all"** (primary).

**Yellow info banner:** Explains why these are unassigned (brand has no mapping).

**Table columns:** ☐ | Product | Brand | Order | Region | Assign to (dropdown)
- Each row's "Brand" column shows the brand name + red "No mapping" subtext.
- "Assign to" is a dropdown filtered by region (e.g., EU brands show only EU employees).
- Selecting an employee triggers an immediate assignment, and admin can mark "remember for future sub-orders of this brand?" checkbox.

**Bottom panel: "Permanent fix · Map a brand to a team member"**
- Two dropdowns side-by-side: Select brand → Select employee
- "Map" button (navy primary)
- Description: "When you map a brand, all current and future sub-orders for that brand auto-assign."

### 7.5 Invoices (`/invoices`)

**Purpose:** Customer invoice review and approval.

**Header:** "Invoices" + subtitle + single button "⚙ Settings" (opens modal with 4 tabs: AI models, Templates, Pricing, Notifications).

**Tabs:**
- Pending review (8) — default, with red badge
- Approved (24)
- Sent (612)

**KPI cards (4):**
- Awaiting review
- Avg time to approve
- AI accuracy (30d) with trend
- Pending value (navy dark card)

**Filter chips:** Search + Brand + Employee + AI confidence (low/medium/high) + Sort

**Invoice cards list:**

Each invoice card has a colored left border:
- 🟢 Green: High AI confidence (>85%) — collapsed by default
- 🟡 Yellow: Medium confidence (70-85%)
- 🟠 Orange/Red: Low confidence (<70%) — expanded by default

**Expanded card layout:**
- Header: INV-YYYY-NNNNNN + confidence badge + "From order ORD-X · Generated by [employee]"
- 2-column body:
  - Left: Line items (product / cost / customer price), with low-confidence lines highlighted in red
  - Right: Calculation breakdown (cost, FX, markup, shipping, VAT, total, profit %)
- Action bar: Approve & send (green primary) | Edit prices | Preview PDF | Reject (red)

**Bulk approve banner (bottom):** Navy bar with "5 high-confidence invoices ready for bulk approval" + "Approve all (5) →" button.

### 7.6 Invoice detail (`/invoices/[id]`)

**Layout:** 2-column grid (1fr + 320px sidebar)

**Left column:**
1. **PDF preview card** — embedded PDF with Download/Open buttons
2. **Line items card** — full breakdown including markup % per line, low-confidence lines highlighted
3. **AI reasoning card** — bullet list explaining each match, with confidence %, including warnings for low-confidence items

**Right column (sidebar):**
1. **Calculation card** — full math breakdown ending with Total + Profit %
2. **Customer card** — avatar, name, email, full address
3. **History card** — timeline (Generated by X · Items mapped · Supplier invoice uploaded)

**Header actions:** Reject | Edit prices | Approve & send → (green primary)

### 7.7 Sourcing employee view (`/queue` for sourcing role)

**Purpose:** Personal task list for the sourcing employee.

**Greeting card:**
- "Good morning, [Name]"
- Summary: "You have **8 items** to source today across **3 brands**"
- 3 mini-stat cards: To do / Done today / Out of stock

**Tabs:** My queue · Upload invoice · History

**Task cards (vertical stack):**
Each card has:
- Header: SUB-XXX-XX + urgency badge ("SLA 4h" red) + "Order ORD-X" right-aligned
- Body: 44px product thumbnail + product name + "Brand: X · Size · Qty"
- Action bar: **"Mark as purchased online"** (navy primary, full-width-ish) + "In-store" (outline) + "Out of stock" (red outline)
- Cards with urgent SLA get red left border

**No prices visible anywhere.**

### 7.8 Warehouse employee view (`/pipeline` for warehouse role)

**Purpose:** Warehouse task pipeline with bulk operations.

**Pipeline summary (top):** 4 cards showing each stage: Incoming (12) / At warehouse (7) / Packing (4) / Shipped today (9). Each card has top border colored by stage.

**Tabs:** Incoming · At warehouse (active) · Packing · Export CSV

**Bulk action bar (when items selected):** Navy bar showing "3 selected · Move all to packing?" with Clear and "Move to packing →" buttons.

**Compact table:**
- Columns: ☐ | Sub-order | Product | Brand | Arrived | Action
- Selected rows highlighted blue tint
- Each row has a "Pack" button (navy)
- Higher density than employee cards (warehouse handles volume)

### 7.9 Fulfiller view (EU role)

**Purpose:** Combined sourcing + warehouse for EU brands.

**Two cycle summary cards (top):**
- "Sourcing cycle" (yellow top border): 5 to do, sub-status counts
- "Warehouse cycle" (blue top border): 3 to do, sub-status counts

**Tabs (color-coded):**
- 🟡 Sourcing · 5 (active)
- 🔵 Warehouse · 3
- All · 8
- History

**Body:** Same card pattern as Sourcing or Warehouse views, depending on active tab. Color of active tab matches its cycle.

### 7.10 KSA Last-mile view (`/deliveries` for ksa_operator role)

**Purpose:** Field delivery operations. Mobile-first design.

**Greeting card (Arabic-friendly):**
- "السلام عليكم [name]" or "Welcome back, [Name]"
- "7 deliveries today across Riyadh"
- **Big "+ Receive shipment" button** (navy primary)
- 4 mini-stats: Just arrived / Out for delivery / Delivered today / Returns

**Tabs:** Just arrived · Out for delivery (active) · History

**Delivery cards:**
- Header: customer avatar + name + SUB-XXX + SLA badge (e.g., "2h" red)
- **Address card (gray, prominent):** "📍 Delivery address" label + full address (multi-line) + phone number (clickable) + "X items · Cash on delivery" or "Prepaid"
- Action bar: **"✓ Mark as delivered"** (green primary, FULL WIDTH on mobile) + "📞 Call" (outline) + "Return" (red outline)

**Mobile considerations:**
- Address tappable → opens Google Maps with the location
- Phone tappable → triggers `tel:` to call
- Big touch targets (44px+)
- GPS integration (future): auto-enable "Mark as delivered" only when within X meters

### 7.11 Payroll (`/payroll`)

**Purpose:** Hubstaff-based hourly payroll calculation.

**Header:** "Payroll" title + subtitle "Hours pulled from Hubstaff · last sync 12 min ago" + 2 buttons: "↻ Sync now" + "Export CSV" (navy primary)

**Period selector card:**
- Toggle: This week / Last 2 weeks (active) / This month / Custom
- Date range display: "Apr 13 — Apr 27"
- Right side: "5 employees · 14 days"

**KPI cards (4):**
- Total hours
- Avg / day
- Active employees
- Total payroll (navy dark, NOTE: "Mixed currencies" because no FX conversion)

**Employees table:**
- Columns: Avatar | Employee | Role | Hours | Rate | Total | ⋯
- Each row shows the employee's individual currency (e.g., $5.00 / €7.00 / SAR 25)
- **NO conversion** — each currency stands alone
- Clicking ⋯ opens: Edit rate / View time entries / Adjust hours

**Footer note:** "Each currency shown standalone — no conversion applied."

### 7.12 Notifications panel

**Trigger:** Click bell icon in page utility bar.

**Panel:** 380px wide popover, white background, 12px radius, drop shadow.

**Header:**
- "Notifications" title
- ⚙ icon (settings) + "Mark all read" link

**Tab pills:** All (12) · Unread (3, red number) · Mentions

**Notification list:**

Each notification:
- Colored left border based on type: Red (critical), Orange (warning), Blue (info), Green (success)
- Title (bold) + optional unread red dot
- Subtitle / description (1 line)
- Relative timestamp on the right ("Now", "12m", "1h", "3h")
- Whole row clickable → routes to relevant page

**Notification types:**
- `unassigned_alert` (RED): "X sub-orders unassigned"
- `sla_at_risk` (ORANGE): "Order ORD-X at risk"
- `invoices_pending` (BLUE): "X invoices pending review"
- `delivery_completed` (gray, info): "Order ORD-X delivered"
- `new_orders` (gray, info): "X new orders from Shopify"
- `integration_sync` (gray, info): "Hubstaff sync completed"
- `integration_failure` (RED): "Hubstaff connection failed"

**"Earlier today" / "Earlier this week" separators** between time groups.

**Footer:** "View all notifications →" link to `/notifications` (full page version).

### 7.13 Command palette (⌘K)

**Trigger:** ⌘K (Mac) or Ctrl+K (Windows), or click the search box in the page utility bar.

**Modal:** 540px wide, dark backdrop, white card, large shadow.

**Header:** Search icon + input (auto-focused) + "esc" hint pill on right.

**Results sections:**
- Customers (matched name) — avatar + name with highlighted match + email/orders/region
- Orders (matched ID/customer) — order icon + ORD-X + customer name + status badge
- Products (matched name)
- Brands (matched name)
- Employees (matched name)
- Quick actions ("Create new order for [query]", etc.)

**Selected item:** Light gray background + ↵ enter pill on the right.

**Footer:** Keyboard hints: ↑↓ Navigate · ↵ Select · ⌘K Toggle

### 7.14 Activity log (`/activity-log`)

**Purpose:** Audit trail of every action in the system.

**Header:** "Activity log" + subtitle "Every action across the system · last 90 days" + Export button.

**Filter bar:** Search + User + Action (status_change, invoice_approved, brand_mapped, etc.) + Resource + Date range.

**Activity feed:**

Day separators (Today · April 27 / Yesterday · April 26 / etc.) in gray.

Each event row:
- Avatar (user or ⚙ for system events)
- User name + role
- Description with inline status badges (e.g., "Changed SUB-X from [pending] to [in_progress]")
- Relative timestamp on the right

**Footer:** "Showing 6 of 248 events · Load more →"

### 7.15 Reports / Analytics (`/reports`)

**Purpose:** Performance, revenue, and team analytics.

**Header:** "Reports" + subtitle + period selector (Last 30 days ▾) + Export button.

**KPI row (4 cards):** Revenue / Profit / Orders fulfilled / Avg fulfillment time, all with trend indicators.

**Revenue chart card:**
- Title + subtitle + legend (Revenue blue / Profit green)
- Stacked bar chart, daily for 30 days
- X-axis labels (Mar 28, Apr 4, Apr 11, Apr 18, Apr 27)

**Bottom row (2 cards side-by-side):**
- **Top brands** (left): Bar list of brands by revenue, each with progress bar in different color
- **Team performance** (right): Employee list with avatar, role, completed items count, on-time %

### 7.16 SLA Health (`/sla-health`)

Charts showing SLA compliance over time:
- Sourcing SLA (24h target) — % met, trend
- Warehouse SLA (48h target)
- Last-mile SLA (72h target)
- Time-to-approve invoice
- Per-team breakdown

### 7.17 Team Load (`/team-load`)

More detailed version of the Dashboard's Team Load section:
- Per-employee breakdown
- Individual workload graphs
- Capacity vs current
- Recommendation: "Marco has capacity, consider routing more to him"

### 7.18 Shipments (`/shipments`)

- Outbound bulk shipments (US/EU → KSA): Create new (DHL), track in transit, mark arrived
- Last-mile (within KSA): View, manage
- Each shipment links to its sub-orders

### 7.19 Returns (`/returns`)

- List of returned items
- Reason categorization
- Per-item return processing
- Refund initiation (out of scope for MVP)

### 7.20 In-context settings (modals/popovers, NOT a Settings page)

**Critical decision:** There is NO `/settings` page in the sidebar. All settings live where they're contextually relevant:

- **Pricing rules** (markup, VAT, shipping) → Inside Invoices page → "⚙ Settings" button → Pricing tab
- **AI models** → Inside Invoices page → Settings modal → AI models tab
- **Invoice templates** → Inside Invoices page → Settings modal → Templates tab
- **WhatsApp templates** → Inside Invoices page → Settings modal → Notifications tab
- **Brand assignments** → User dropdown → "Brands & assignments"
- **Stores** → User dropdown → "Stores"
- **Users / roles** → User dropdown → "Team & roles"
- **Carriers** → User dropdown → "Carriers"
- **Integrations** (Hubstaff, Shopify, Twilio, OpenAI status) → User dropdown → "Integrations"
- **Security / 2FA** → User dropdown → "Security"
- **My profile** → User dropdown → "Profile & presence"
- **My language / currency display** → User dropdown → "My preferences"

This is a deliberate architectural decision based on the user's feedback that a generic Settings page would be redundant when settings are better placed contextually.

---

## 8. Component library

### StatusBadge

```tsx
<StatusBadge status="in_progress" size="sm" />
```

Props: `status` (one of 15 statuses), `size` ("xs" | "sm" | "md")

Renders a colored pill: background = status color light, text = status color dark, border-radius 3-4px, font-size 10-11px, padding 2px 6-8px, font-weight 500.

### StatusSummaryBar

```tsx
<StatusSummaryBar segments={[
  { color: 'amber', count: 2, label: 'Pending' },
  { color: 'purple', count: 1, label: 'In progress' },
]} />
```

Renders a horizontal multi-color bar where segment widths are proportional to counts. Below the bar, an inline list of legends with color dots.

Used in Orders table to show at-a-glance status distribution per order.

### Avatar

```tsx
<Avatar name="Layla K." role="ksa_operator" size="sm" />
```

Renders initials in a colored square. Background color is determined by the user's role (sourcing → amber, warehouse → blue, fulfiller → purple, ksa → green, admin → navy).

Sizes: xs (18px), sm (22px), md (28-32px), lg (40px).

### TaskCard (employee views)

```tsx
<TaskCard
  subOrderId="SUB-48210-00"
  productName="Linen Crew Tee — Bone"
  brand="Kori"
  size="M"
  qty={1}
  urgency="urgent" // "urgent" | "normal" | "completed"
  primaryAction={{ label: "Mark as purchased online", onClick }}
  secondaryActions={[
    { label: "In-store", onClick },
    { label: "Out of stock", onClick, variant: "danger" },
  ]}
/>
```

Renders the sourcing/fulfiller task card pattern. Urgency adds left border color.

### EmptyState

```tsx
<EmptyState
  icon={CheckCircle}
  title="All caught up"
  description="No items pending. Check back later."
/>
```

Used when a list is empty. Centered icon + heading + description.

### DataTable

Generic table component supporting:
- Sortable columns
- Bulk select with checkbox
- Inline expand
- Row click handlers
- Custom cell renderers
- Empty states
- Loading skeletons
- Pagination footer

### FilterChipsBar

Horizontal bar with:
- Search input on the left
- Filter chips (color-coded for active state — blue with "X" remove icon)
- Sort dropdown on the right
- "Clear all" link

### Modal

Standard modal with:
- 0.5px border, 12px radius, white background
- Header with title + close (X)
- Body (scrollable if needed)
- Footer with buttons (Cancel + primary action)
- Backdrop: `rgba(0,0,0,0.5)`

### NotificationItem

Single row in notifications panel:
- Colored left border (3px) based on type
- Background tinted slightly if unread
- Title + optional unread red dot
- Subtitle (1 line, truncated if needed)
- Timestamp right-aligned (relative)

### KPICard

```tsx
<KPICard
  label="Total orders"
  value="1,284"
  trend={{ direction: "up", value: "8.2%", color: "success" }}
  variant="default" // "default" | "danger" | "navy"
/>
```

White card with 0.5px border, navy variant inverts to dark with white text.

---

## 9. Responsive behavior

### Breakpoints

```
Mobile:  < 768px
Tablet:  768px - 1023px
Desktop: ≥ 1024px
```

### Desktop (≥ 1024px)

- Sidebar fully expanded (220px) with all sections visible
- Tables show all columns
- KPI grids: 4-5 columns
- Page utility bar: search 280px + bell + language

### Tablet (768px - 1023px)

- Sidebar collapses to icons-only (60px) — tooltips show full names on hover
- Tables: hide secondary columns or use horizontal scroll
- KPI grids: 2-3 columns
- Page utility bar: search shrinks, bell + language remain

### Mobile (< 768px)

- **Sidebar disappears** — replaced by **bottom navigation bar** (4-5 icons: Home, primary lists, Search, More)
- **Tables become cards** — each row a vertically stacked card
- **KPI grid: 2x2** (or single column with horizontal scroll)
- **Page utility bar:** Hamburger ☰ + page title + bell on the right (search moves to a screen)
- **User chip:** Accessed via "More" tab
- **Forms:** Full-width inputs, larger touch targets (44px min)
- **Action buttons:** Often full-width when single primary action

### Mobile-specific patterns

- **Bottom sheets** for filters, status changes (instead of dropdowns)
- **Floating Action Button (FAB)** for primary actions (e.g., "+ New" in shipments)
- **Pull-to-refresh** on list pages
- **Swipe actions** (left swipe to archive, right swipe to mark done) on lists

---

## 10. Notifications system

### Real-time architecture

Use **Supabase Realtime** to push notifications to clients.

```sql
-- Subscribe to user's notifications
supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${currentUserId}`,
  }, handleNewNotification)
  .subscribe();
```

### Notification table

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  type text NOT NULL,  -- 'unassigned_alert' | 'sla_at_risk' | etc.
  severity text NOT NULL,  -- 'critical' | 'warning' | 'info' | 'success'
  title text NOT NULL,
  description text,
  resource_type text,  -- 'order' | 'sub_order' | 'invoice' | etc.
  resource_id uuid,
  href text,  -- where clicking goes
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_user_read ON notifications(user_id, read_at, created_at DESC);
```

### Trigger sources

Notifications are inserted automatically via Postgres triggers and edge functions:

| Source | Event | Notification |
|---|---|---|
| `sub_orders` insert | New sub-order is unassigned | `unassigned_alert` to all admins |
| `sub_orders` update | Status changed to `delayed` | `sla_at_risk` to assigned employee + admins |
| `customer_invoices` insert | Status = `pending_review` | `invoices_pending` to admins |
| Cron (hourly) | Hubstaff sync completes | `integration_sync` to admin who triggered (or none) |
| API client wrapper | External API call fails | `integration_failure` to admins |
| `sub_orders` update | Status = `delivered` | `delivery_completed` to admins |
| Shopify webhook | New order ingested | `new_orders` (rate-limited to 1 per 15 min) |

### Notification settings (per user)

- Email digest: daily / weekly / off
- Push: enabled / disabled
- Per-type: opt-in/out

---

## 11. Integration specs

### Shopify

**Webhooks:**
- `orders/create` (live) — ingests new orders, splits into sub-orders, auto-routes by brand
- `orders/updated` (future) — sync customer info changes

**Verification:** HMAC-SHA256 over raw body using `SHOPIFY_WEBHOOK_SECRET`. Constant-time comparison.

**Auto-split logic:**
1. Insert order row (with `raw_payload jsonb`)
2. For each line item, create a sub-order
3. Match line item's `vendor` field to a brand (case-insensitive, fuzzy match against `brands.name` and `brands.aliases`)
4. If matched and brand has assignment → set `assigned_employee_id`
5. If no brand match OR no assignment → set status `unassigned`, flag in `sub_orders`, trigger admin notification

**Fallback polling:** Edge function runs every 60 minutes to pull orders Shopify might have missed in webhook delivery.

### Hubstaff

**Status:** Not yet connected (env vars missing).

**Pull pattern:** Edge function runs hourly, fetches new time entries via Hubstaff API.

```typescript
// /api/cron/pull-hubstaff/route.ts
export async function GET() {
  const lastSync = await getLastSyncTimestamp();
  const entries = await fetchHubstaffEntries({ since: lastSync });
  
  for (const entry of entries) {
    await supabase.from('time_entries').upsert({
      hubstaff_entry_id: entry.id,
      profile_id: await mapHubstaffUserToProfile(entry.user_id),
      started_at: entry.starts_at,
      ended_at: entry.stops_at,
      duration_seconds: entry.tracked,
      raw_payload: entry,
      pulled_at: new Date().toISOString(),
    }, { onConflict: 'hubstaff_entry_id' });
  }
  
  await logApiCall('hubstaff', '/v1/activities/daily', 'GET', 200, /*latency*/, /*cost*/);
}
```

### Twilio (WhatsApp)

**Status:** Live.

**Trigger:** On every `sub_orders.status` change where the new status has `notifies_customer = true`.

**Phone normalization:** All Saudi numbers normalized to `+9665XXXXXXXX` format before sending.

**Templates:** 8 pre-approved Twilio Content Template SIDs, one per "loud" status. Variables: `{{1}} = sub_order_number`, `{{2}} = product_title`.

### OpenAI / OpenRouter (AI)

**Status:** Mocked in MVP. Real integration deferred.

When real:
- OCR: Send supplier invoice PDF/image to vision model
- Invoice generation: Generate customer invoice with markup, formatted to template

**Configurable in:** Invoices → Settings → AI models tab.

### DHL (shipments)

**Status:** Missing (credentials pending).

When live:
- Create bulk shipment label (US/EU → KSA)
- Get tracking number
- Update sub-order with shipment reference

### Resend (email)

**Status:** Missing.

When live:
- Send approved customer invoice PDFs to customers
- Send invitation emails to new team members

---

## 12. Security model

### Layered authorization

1. **Middleware:** Refreshes session on every request, redirects to `/login` if no session
2. **Layout-level `requireRole`:** Each route group checks role membership
3. **Server actions:** Re-verify role inside every mutation (defense in depth)
4. **Row Level Security (RLS):** On every table, every user role
5. **Column guards (Postgres triggers):** Non-admins can't edit profile.role, sub_orders pricing fields, etc.
6. **Status transition trigger:** Enforces `allowed_from_roles` whitelist on status changes
7. **Brand-region trigger:** Hard-blocks assigning a US brand to an EU employee

### RLS examples

```sql
-- Sub-orders: employees see only their assigned ones; admins see all
CREATE POLICY "employees_own_sub_orders" ON sub_orders
  FOR SELECT
  USING (
    assigned_employee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Customer invoices: admins only
CREATE POLICY "admin_only_invoices" ON customer_invoices
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

### Webhook security

```typescript
async function verifyShopifyHmac(req: Request): Promise<boolean> {
  const signature = req.headers.get('x-shopify-hmac-sha256');
  const body = await req.text();
  const computed = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET!)
    .update(body)
    .digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature || ''),
    Buffer.from(computed)
  );
}
```

### API call logging

Every external API call routes through a centralized wrapper:

```typescript
// lib/api-client.ts
async function apiCall<T>({
  service,    // 'shopify' | 'twilio' | 'openai' | 'dhl' | 'hubstaff'
  endpoint,
  method,
  body,
}: ApiCallParams): Promise<T> {
  const start = Date.now();
  try {
    const response = await fetch(/* ... */);
    await logApiCall({
      service,
      endpoint,
      method,
      status: response.ok ? 'success' : 'error',
      http_status: response.status,
      latency_ms: Date.now() - start,
      cost_usd: estimateCost(service, response),
    });
    return response.json();
  } catch (e) {
    await logApiCall({ /* error logging */ });
    throw e;
  }
}
```

**Never logs request/response bodies, headers, or secrets.**

---

## 13. MVP scope vs future

### MVP (must ship)

✅ Authentication: Login, invitation flow, password reset
✅ All 15 status workflow with role-based whitelisting
✅ Admin: Dashboard, Orders, Order detail, Unassigned Queue
✅ Admin: Invoices (list + detail + manual approval, NO AI generation)
✅ Admin: Team views (Sourcing/Warehouse/EU/KSA observers)
✅ Admin: Payroll (with manual hour entry until Hubstaff is connected)
✅ Admin: Activity Log
✅ Admin: Reports (basic charts)
✅ Employee: Sourcing queue, Warehouse pipeline, Fulfiller dual-cycle, KSA deliveries
✅ Notifications system (in-app + email digest)
✅ Command palette (⌘K)
✅ Shopify webhook ingestion
✅ Twilio WhatsApp notifications
✅ Multi-currency support (no FX conversion)
✅ Multi-store ready (DB schema, single store in UI)
✅ Mobile responsive layouts
✅ User dropdown with all setup options
✅ In-context settings (no separate Settings page)

### Phase 2 (after MVP stabilizes)

🔄 AI OCR for supplier invoices
🔄 AI customer invoice generation
🔄 Hubstaff real integration
🔄 DHL real integration (currently mocked)
🔄 Resend email delivery for invoices
🔄 Customer-facing invoice PDF rendering pipeline
🔄 Multi-store UI (when 2nd store added)
🔄 Real-time notifications via Supabase channels

### Phase 3 (nice to have)

⏳ Saved filters / views
⏳ Bulk actions on orders table
⏳ GPS-based "Mark as delivered" for KSA team
⏳ Photo capture for proof of delivery
⏳ Native mobile app (PWA may be sufficient)
⏳ Customer self-service portal
⏳ Returns processing UI

---

---

## 14. Performance & operational quality

This section covers production-grade requirements that ensure Optify performs well at scale and provides a polished operational experience. **All items in this section are mandatory** — they were identified during architectural review as critical to avoid production failures and operational pain.

### 14.1 JWT-based RLS (50x performance boost)

**Problem:** The naive RLS policy `USING (is_admin(auth.uid()))` queries `user_roles` on every row check. On a table with 100k rows, this is catastrophically slow.

**Solution:** Embed user roles into the JWT during sign-in. RLS reads from `auth.jwt()` instead of querying the database.

**Implementation:**

Set up a Supabase Auth Hook (Custom Access Token Hook) to enrich the JWT with roles:

```sql
-- supabase/migrations/.../auth_hook_custom_token.sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_roles_arr text[];
BEGIN
  -- Fetch all roles for this user
  SELECT array_agg(role::text) INTO user_roles_arr
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid;

  claims := event->'claims';

  -- Attach roles array to claims
  IF user_roles_arr IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_roles}', to_jsonb(user_roles_arr));
  ELSE
    claims := jsonb_set(claims, '{user_roles}', '[]'::jsonb);
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Grant access for the auth admin to call this
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT ALL ON TABLE public.user_roles TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
```

Then enable the hook in Supabase Dashboard → Authentication → Hooks → "Custom Access Token Hook" → select `custom_access_token_hook`.

**RLS helpers using JWT:**

```sql
-- Replace the slow is_admin() function
CREATE OR REPLACE FUNCTION jwt_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() -> 'user_roles')::jsonb ? 'admin';
$$;

CREATE OR REPLACE FUNCTION jwt_has_role(p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() -> 'user_roles')::jsonb ? p_role;
$$;
```

**Use these in RLS policies:**

```sql
-- Fast policy
CREATE POLICY view_sub_orders ON sub_orders
  FOR SELECT TO authenticated
  USING (assigned_employee_id = auth.uid() OR jwt_is_admin());
```

**When roles change, invalidate the session:** When admin updates `user_roles`, force the affected user to log in again to refresh their JWT. (Alternatively use short-lived JWTs of 5–15 minutes.)

### 14.2 Materialized views for Dashboard KPIs

**Problem:** The Dashboard runs 5+ separate queries to populate KPI cards. With many orders, this slows the page significantly.

**Solution:** Precompute KPIs in materialized views, refreshed on a schedule.

```sql
-- Dashboard top KPIs
CREATE MATERIALIZED VIEW mv_dashboard_kpis AS
SELECT
  COUNT(*) FILTER (WHERE TRUE)::int AS total_orders,
  COUNT(*) FILTER (WHERE so.status NOT IN ('delivered', 'cancelled', 'returned', 'failed', 'out_of_stock'))::int AS active_count,
  COUNT(*) FILTER (WHERE so.is_delayed = true)::int AS delayed_count,
  COUNT(*) FILTER (WHERE so.is_at_risk = true AND so.is_delayed = false)::int AS at_risk_count,
  COUNT(*) FILTER (WHERE so.status = 'delivered')::int AS completed_count,
  COUNT(*) FILTER (WHERE so.status = 'delivered' AND so.status_changed_at <= so.sla_due_at)::int AS on_time_count,
  -- Per-currency totals (cannot aggregate)
  jsonb_object_agg(
    o.currency,
    jsonb_build_object(
      'count', count_per_currency,
      'total', total_per_currency
    )
  ) AS revenue_by_currency
FROM sub_orders so
JOIN orders o ON o.id = so.order_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS count_per_currency,
    SUM(o2.total) AS total_per_currency
  FROM orders o2
  WHERE o2.currency = o.currency
    AND o2.shopify_created_at >= now() - interval '30 days'
) per_curr ON true
WHERE so.created_at >= now() - interval '90 days';

CREATE UNIQUE INDEX idx_mv_dashboard_kpis ON mv_dashboard_kpis ((1));

-- Team load per role
CREATE MATERIALIZED VIEW mv_team_load AS
SELECT
  ur.role::text AS team,
  COUNT(DISTINCT ur.user_id)::int AS member_count,
  COUNT(DISTINCT so.id) FILTER (
    WHERE so.status NOT IN ('delivered', 'cancelled', 'returned', 'failed', 'out_of_stock')
  )::int AS active_items,
  AVG(CASE
    WHEN so.is_delayed THEN 100
    WHEN so.is_at_risk THEN 75
    ELSE 50
  END)::int AS load_percent
FROM user_roles ur
LEFT JOIN sub_orders so ON so.assigned_employee_id = ur.user_id
WHERE ur.role IN ('sourcing', 'warehouse', 'fulfiller', 'ksa_operator')
GROUP BY ur.role;

CREATE UNIQUE INDEX idx_mv_team_load_team ON mv_team_load (team);
```

**Refresh schedule:** Use Supabase `pg_cron` extension to refresh every 5 minutes.

```sql
SELECT cron.schedule(
  'refresh-dashboard-kpis',
  '*/5 * * * *',
  $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_kpis;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_team_load;
  $$
);
```

**Frontend behavior:** Show a subtle "Updated 2 min ago" indicator on the dashboard so users know data is near-real-time, not live.

### 14.3 Connection pooling via Supabase Pooler

**Problem:** Next.js App Router with React Server Components creates a new connection for every request. The default Supabase Postgres has a 60-connection limit that you'll hit with under 100 concurrent users.

**Solution:** Use Supabase's PgBouncer pooler for serverless workloads.

**Two Supabase URLs to use:**
- **Pooler URL (port 6543, transaction mode)** — for short-lived queries (most requests)
- **Direct URL (port 5432)** — for migrations and long-running queries only

**Environment setup:**

```bash
# .env.local

# Pooler URL — used by app code for normal queries
DATABASE_URL=postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# Direct URL — used only for migrations and Supabase CLI
DIRECT_URL=postgres://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres

# Supabase JS client URL (uses HTTP, not direct pg connection)
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key]
SUPABASE_SERVICE_ROLE_KEY=[service role key]
```

**Important:** When using the pooler with transaction mode, do NOT use:
- `LISTEN` / `NOTIFY` (use Supabase Realtime instead)
- Prepared statements with `pg_prepare`
- Session-level state (e.g., `SET session ...`)

For Drizzle/Prisma migrations, point to `DIRECT_URL`. For runtime queries, use `DATABASE_URL`.

### 14.4 Reports per currency (no FX aggregation)

**Problem:** Reports page shows "Revenue: SAR 482k" — but orders span SAR/EUR/USD. Aggregating into one number is meaningless without FX.

**Solution:** Display each currency as a separate section on the Reports page.

**UI pattern:**

```
Reports                              [Last 30 days ▾] [Export]

┌─ Revenue by currency ─────────────────────────────────┐
│                                                       │
│  SAR     │ EUR    │ USD    │ AED                      │
│  482,500 │ 24,800 │  8,420 │  1,200                   │
│  ↑ 24%   │ ↑ 18%  │ ↑ 5%   │ —                        │
│  342 ord │ 24 ord │ 8 ord  │ 1 ord                    │
│                                                       │
└───────────────────────────────────────────────────────┘
```

**Implementation:**

```sql
-- View aggregating per-currency
CREATE VIEW v_reports_revenue_by_currency AS
SELECT
  o.currency,
  COUNT(DISTINCT o.id) AS order_count,
  SUM(o.total) AS total_revenue,
  -- Compare to previous period (same length)
  COUNT(DISTINCT o.id) FILTER (
    WHERE o.shopify_created_at >= (CURRENT_DATE - INTERVAL '60 days')
      AND o.shopify_created_at < (CURRENT_DATE - INTERVAL '30 days')
  ) AS prev_order_count,
  SUM(o.total) FILTER (
    WHERE o.shopify_created_at >= (CURRENT_DATE - INTERVAL '60 days')
      AND o.shopify_created_at < (CURRENT_DATE - INTERVAL '30 days')
  ) AS prev_total_revenue
FROM orders o
WHERE o.shopify_created_at >= (CURRENT_DATE - INTERVAL '30 days')
GROUP BY o.currency;
```

Apply same pattern to Top Brands and Team Performance — each currency standalone, never combined.

### 14.5 Optimistic updates for employee actions

**Problem:** When an employee on slow network clicks "Mark as purchased," the page freezes for 2-3 seconds while waiting for server response. Bad UX.

**Solution:** Update UI immediately, send the request in background, rollback on error.

**Pattern with React + Supabase:**

```tsx
// components/employee/TaskCard.tsx
'use client';

import { useOptimistic, useTransition } from 'react';
import { toast } from 'sonner';
import { updateSubOrderStatus } from '@/app/actions/sub-orders';

export function TaskCard({ subOrder }: { subOrder: SubOrder }) {
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(
    subOrder.status,
    (current, newStatus: string) => newStatus
  );

  const handlePurchase = () => {
    startTransition(async () => {
      // Update UI instantly
      setOptimisticStatus('purchased_online');

      // Send to server
      const result = await updateSubOrderStatus({
        id: subOrder.id,
        status: 'purchased_online',
      });

      if (!result.success) {
        // Rollback handled by useOptimistic automatically
        toast.error('Could not save. Try again.');
      } else {
        toast.success('Marked as purchased');
      }
    });
  };

  return (
    <div className={`task-card ${isPending ? 'opacity-70' : ''}`}>
      <StatusBadge status={optimisticStatus} />
      <button onClick={handlePurchase} disabled={isPending}>
        Mark as purchased online
      </button>
    </div>
  );
}
```

**Server action:**

```tsx
// app/actions/sub-orders.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateSubOrderStatus({ id, status }: { id: string; status: string }) {
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('sub_orders')
    .update({
      status,
      status_changed_by: user.user.id,
      status_changed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/queue');
  return { success: true };
}
```

**Apply optimistic updates to:** Sourcing "Mark purchased" actions, Warehouse "Pack" button, KSA "Mark delivered," Invoice "Approve."

### 14.6 Virtual scrolling for large tables

**Problem:** Rendering 1000+ rows in a regular `<table>` causes severe lag (DOM with 10k+ nodes).

**Solution:** Use TanStack Virtual to render only visible rows.

**Install:**

```bash
npm install @tanstack/react-virtual
```

**Pattern:**

```tsx
// components/shared/VirtualTable.tsx
'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

export function VirtualTable<T>({ rows, renderRow, rowHeight = 56 }: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderRow(rows[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Apply to:** Orders table (when > 100 rows), Pipeline view columns (when > 30 cards each), Activity log.

**For Pipeline specifically:** Limit each column to a 7-day window of items by default. Add "Load older" button to fetch more.

### 14.7 Bulk actions on tables

**Problem:** Admin handles 50 delayed orders one-by-one — frustrating.

**Solution:** Floating action bar that appears when rows are selected.

**UI pattern:**

```
┌──┬──────────┬──────────┬─────┬────────┬──────┬─────────┐
│☐ │ Order    │ Customer │Subs │ Status │Total │ Alerts  │
├──┼──────────┼──────────┼─────┼────────┼──────┼─────────┤
│☑ │ ORD-48210│ Elena V. │ 3/3 │  ...   │ $482 │ Urgent  │
│☑ │ ORD-48207│ Fatima A.│ 4/4 │  ...   │SAR 4k│ SLA risk│
│☐ │ ORD-48201│ Aoife K. │ 2/2 │  ...   │SAR 1k│         │
└──┴──────────┴──────────┴─────┴────────┴──────┴─────────┘

┌── 2 selected ─────────────────────────────────────────┐ ← navy floating bar
│ [Reassign] [Change status] [Export] [Cancel]      ✕   │
└───────────────────────────────────────────────────────┘
```

**Bulk operations to support:**

| Action | Available on | Permissions |
|---|---|---|
| Reassign | Orders, Sub-orders, Unassigned queue | Admin |
| Change status | Sub-orders | Admin (any), Employee (whitelist only) |
| Export CSV | Orders, Invoices, Activity log | Admin |
| Mark as paid | Invoices | Admin |
| Bulk approve | Pending invoices | Admin (high-confidence only) |
| Archive | Notifications | Self |

**Implementation:** Use a Zustand or React Context store to hold selection state across components.

### 14.8 Saved filters / Views

**Problem:** Admin checks "EU urgent orders" 10 times a day — re-applying 4 filters each time.

**Solution:** Allow saving filter combinations as named "Views."

**UI pattern:**

```
┌─ Views: ────────────────────────────────────────────┐
│ [All orders ▾] [⋆ EU urgent] [⋆ KSA pending] [+ Save]│
└─────────────────────────────────────────────────────┘
```

Selecting a view applies its filters instantly. Star icon = saved. Click "+ Save" while filters are active to save current state.

**Schema:**

```sql
CREATE TABLE saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  page text NOT NULL,                 -- 'orders', 'invoices', etc.
  filters jsonb NOT NULL,             -- { status: ['delayed'], region: 'EU', ... }
  is_shared boolean NOT NULL DEFAULT false,  -- visible to other admins
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page, name)
);

CREATE INDEX idx_saved_views_user_page ON saved_views(user_id, page);
```

**RLS:**

```sql
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_views_own ON saved_views
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR (is_shared = true AND jwt_is_admin()));
```

### 14.9 Notifications archive table

**Problem:** Notifications grow unbounded — table will hit 1M+ rows in a year, slowing every query.

**Solution:** Archive notifications older than 30 days to a separate table. Live table stays fast.

**Schema:**

```sql
-- Archive table mirrors live table
CREATE TABLE notifications_archive (LIKE notifications INCLUDING ALL);

-- Cron job moves old notifications nightly
SELECT cron.schedule(
  'archive-old-notifications',
  '0 3 * * *',  -- 3 AM daily
  $$
    WITH moved AS (
      DELETE FROM notifications
      WHERE created_at < now() - interval '30 days'
      RETURNING *
    )
    INSERT INTO notifications_archive
    SELECT * FROM moved;
  $$
);
```

**RLS on archive:** Same as live table. UI accesses archive only on explicit "View older" request.

### 14.10 Search expansion (sub-orders + tracking + email)

**Problem:** Command palette searches Customers/Orders/Brands but employees mostly search by sub-order number ("SUB-48210-00") or tracking number.

**Solution:** Single Postgres function that searches across all relevant tables in one query.

```sql
CREATE OR REPLACE FUNCTION command_palette_search(p_query text, p_limit int DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'customers', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'name', first_name || ' ' || last_name, 'email', email
      ))
      FROM customers
      WHERE first_name ILIKE '%' || p_query || '%'
         OR last_name ILIKE '%' || p_query || '%'
         OR email ILIKE '%' || p_query || '%'
      LIMIT p_limit
    ),
    'orders', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'number', shopify_order_number
      ))
      FROM orders
      WHERE shopify_order_number ILIKE '%' || p_query || '%'
      LIMIT p_limit
    ),
    'sub_orders', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'number', sub_order_number, 'product', product_title
      ))
      FROM sub_orders
      WHERE sub_order_number ILIKE '%' || p_query || '%'
      LIMIT p_limit
    ),
    'shipments', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'tracking', tracking_number
      ))
      FROM shipments
      WHERE tracking_number ILIKE '%' || p_query || '%'
      LIMIT p_limit
    ),
    'brands', (
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name))
      FROM brands
      WHERE name ILIKE '%' || p_query || '%'
      LIMIT p_limit
    ),
    'employees', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'name', full_name, 'email', email
      ))
      FROM profiles
      WHERE full_name ILIKE '%' || p_query || '%'
         OR email ILIKE '%' || p_query || '%'
      LIMIT p_limit
    )
  ) INTO result;

  RETURN result;
END;
$$;
```

**Frontend:**

```tsx
const { data } = await supabase.rpc('command_palette_search', {
  p_query: query,
  p_limit: 5,
});
// data.customers, data.orders, data.sub_orders, etc.
```

**Indexes:** Trigram indexes on all searchable columns (already in schema for brands, add for sub_orders.sub_order_number, shipments.tracking_number).

**Debounce:** 250ms in the input handler before firing the search.

### 14.11 Offline mode for KSA Last-mile

**Problem:** KSA delivery operators work in the field with patchy mobile connectivity. If they tap "Mark as delivered" without internet, the action is lost.

**Solution:** Service worker + IndexedDB queue. Tap registers locally; syncs when online.

**Architecture:**

1. **Service worker** caches the app shell + recent delivery list
2. **IndexedDB queue** for pending actions
3. **Background Sync API** triggers sync when network returns
4. **UI indicator** shows "Offline · 3 actions queued"

**Setup:**

```typescript
// public/sw.js (service worker)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-delivery-actions') {
    event.waitUntil(syncQueuedActions());
  }
});

async function syncQueuedActions() {
  const db = await openDB('optify-offline', 1);
  const queue = await db.getAll('action-queue');

  for (const action of queue) {
    try {
      await fetch(action.endpoint, {
        method: action.method,
        headers: action.headers,
        body: JSON.stringify(action.body),
      });
      await db.delete('action-queue', action.id);
    } catch (err) {
      // Will retry on next sync event
      break;
    }
  }
}
```

**Frontend:**

```tsx
// hooks/useOfflineAction.ts
export function useOfflineAction() {
  return async (endpoint: string, body: any) => {
    if (navigator.onLine) {
      return fetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
    }

    // Queue for later
    const db = await openDB('optify-offline', 1);
    await db.add('action-queue', {
      id: crypto.randomUUID(),
      endpoint,
      method: 'POST',
      body,
      queued_at: new Date().toISOString(),
    });

    // Register background sync
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('sync-delivery-actions');

    toast.info('Saved offline. Will sync when online.');
  };
}
```

**Apply to:** KSA "Mark as delivered," "Mark as out for delivery," "Returned" actions.

### 14.12 ISR caching for Reports page

**Problem:** Reports page recomputes on every visit. Wasteful for data that doesn't change minute-to-minute.

**Solution:** Next.js Incremental Static Regeneration. Reports revalidates every hour.

```tsx
// app/(admin)/reports/page.tsx
export const revalidate = 3600; // 1 hour

export default async function ReportsPage() {
  const data = await getReportsData();
  return <ReportsView data={data} />;
}
```

**Manual revalidation:** Admin can click "Refresh" button to force immediate revalidation.

```tsx
// app/api/revalidate/reports/route.ts
import { revalidatePath } from 'next/cache';

export async function POST() {
  revalidatePath('/reports');
  return Response.json({ revalidated: true });
}
```

**Apply to:** Reports, SLA Health, Team Load (at admin overview level). Do NOT use ISR on Dashboard or Orders — those need to be live.

### 14.13 React Query for client-side caching

**Problem:** Navigating between pages refetches the same data. Wasteful.

**Solution:** Wrap mutations and queries with TanStack Query.

```bash
npm install @tanstack/react-query
```

**Setup:**

```tsx
// app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,        // 30s before refetch
        gcTime: 5 * 60_000,       // 5 min cache retention
        refetchOnWindowFocus: true,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

**Use it:**

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';

function OrdersList() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'pending'],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('orders')
        .select('*, customer:customers(*), sub_orders(count)')
        .order('shopify_created_at', { ascending: false });
      return data;
    },
  });

  if (isLoading) return <SkeletonTable />;
  return <OrdersTable orders={data} />;
}
```

**Invalidation pattern after mutation:**

```tsx
const queryClient = useQueryClient();
await updateSubOrder(id, status);
queryClient.invalidateQueries({ queryKey: ['orders'] });
```

### 14.14 Inline editing in tables

**Problem:** Editing a sub-order's status means navigating to detail page → back. Tedious.

**Solution:** Status cells in the Orders table become dropdowns on click.

**Pattern:**

```tsx
function StatusCell({ subOrder }: { subOrder: SubOrder }) {
  const [isEditing, setIsEditing] = useState(false);
  const [optimistic, setOptimistic] = useOptimistic(subOrder.status);

  if (!isEditing) {
    return (
      <button onClick={() => setIsEditing(true)} className="hover:bg-gray-50 px-2 py-1 rounded">
        <StatusBadge status={optimistic} />
      </button>
    );
  }

  return (
    <Select
      value={optimistic}
      onValueChange={async (newStatus) => {
        setOptimistic(newStatus);
        await updateSubOrderStatus({ id: subOrder.id, status: newStatus });
        setIsEditing(false);
      }}
      onOpenChange={(open) => !open && setIsEditing(false)}
      autoFocus
    >
      <SelectTrigger />
      <SelectContent>
        {allowedStatuses.map((s) => (
          <SelectItem key={s.key} value={s.key}>
            {s.label_en}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

**Apply to:** Status cells in tables, brand assignments in Unassigned Queue, employee notes fields.

**Also enable double-click to edit** for power users.

### 14.15 Recent searches in command palette

**Problem:** Admin searches the same customer name 5 times in 10 minutes — typing every time.

**Solution:** Show recent searches when palette opens with empty input.

```tsx
'use client';

import { useEffect, useState } from 'react';

const RECENT_SEARCHES_KEY = 'optify_recent_searches';
const MAX_RECENT = 5;

export function CommandPalette() {
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (stored) setRecentSearches(JSON.parse(stored));
  }, []);

  const onSelect = (selectedQuery: string) => {
    const updated = [
      selectedQuery,
      ...recentSearches.filter((s) => s !== selectedQuery),
    ].slice(0, MAX_RECENT);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    // ... navigate to result
  };

  return (
    <Dialog>
      <DialogContent>
        <input value={query} onChange={(e) => setQuery(e.target.value)} />

        {!query && recentSearches.length > 0 && (
          <div>
            <h3 className="text-xs uppercase text-gray-500">Recent</h3>
            {recentSearches.map((q) => (
              <button key={q} onClick={() => setQuery(q)}>
                <ClockIcon /> {q}
              </button>
            ))}
          </div>
        )}

        {query && <SearchResults query={query} onSelect={onSelect} />}
      </DialogContent>
    </Dialog>
  );
}
```

### Performance budget targets

These are the targets every page must meet on a mid-tier laptop with 100Mbps connection:

| Metric | Target | Critical for |
|---|---|---|
| First Contentful Paint | < 1s | All pages |
| Time to Interactive | < 2s | Dashboard, Orders |
| Largest Contentful Paint | < 1.5s | All pages |
| Total Blocking Time | < 200ms | Pipeline view (drag/drop) |
| Cumulative Layout Shift | < 0.1 | All pages |
| API response p95 | < 300ms | All endpoints |
| Database query p95 | < 100ms | All queries |

**Tools:** Lighthouse CI in your build pipeline. Reject deploys that violate budgets.

### Operational quality checklist

Every page must satisfy these before considered "done":

- ✅ Loading state (skeleton, not just spinner)
- ✅ Empty state with helpful message and CTA
- ✅ Error state with retry button
- ✅ Optimistic updates on user actions
- ✅ Toast notifications for success/error
- ✅ Keyboard shortcuts (⌘K, Esc, Enter)
- ✅ Focus management (modal → input, after close → trigger)
- ✅ Responsive at 375 / 768 / 1024 / 1440 px
- ✅ Print stylesheet (for invoices)
- ✅ Accessible (ARIA, keyboard nav, color contrast 4.5:1)
- ✅ Memoized expensive computations
- ✅ Debounced inputs (250ms minimum)
- ✅ Virtualized lists with > 100 items
- ✅ Cached queries via React Query
- ✅ Error boundaries to prevent full-page crashes

---

## 15. Build instructions

### Setup

1. **Create Next.js 14 app** with App Router and TypeScript
2. **Initialize Supabase** project, copy `URL` and `ANON_KEY`
3. **Run migrations** from `DATABASE_SCHEMA.md` (separate file)
4. **Install packages** listed in §2
5. **Configure env vars:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   SHOPIFY_WEBHOOK_SECRET=
   SHOPIFY_ADMIN_TOKEN=
   TWILIO_ACCOUNT_SID=
   TWILIO_AUTH_TOKEN=
   TWILIO_WHATSAPP_NUMBER=
   OPENAI_API_KEY=             # optional, mock fallback if missing
   HUBSTAFF_TOKEN=             # optional, mock fallback if missing
   DHL_API_KEY=                # optional, mock fallback if missing
   RESEND_API_KEY=             # optional, mock fallback if missing
   ```

### Development order

Recommended sequence to minimize blockers:

1. **Auth shell** (login page + middleware + `requireRole`)
2. **Sidebar + page utility bar** (layout for all subsequent pages)
3. **User dropdown** (premium dark variant)
4. **Admin Dashboard** (KPI cards + Team load + Orders table)
5. **Admin Orders** (table + pipeline view + expandable rows)
6. **Order detail page**
7. **Unassigned Queue page**
8. **Sourcing employee view** (template for other employee views)
9. **Warehouse, Fulfiller, KSA views** (variations of employee pattern)
10. **Invoices** (Pending Review + Detail + Settings modal)
11. **Payroll** (manual hours first, Hubstaff later)
12. **Notifications panel + bell**
13. **Command palette**
14. **Activity log**
15. **Reports/Analytics**
16. **Mobile responsiveness** pass
17. **Shopify webhook integration**
18. **Twilio WhatsApp integration**

### Quality gates

Before shipping any page:
- ✅ Renders correctly at 1440px, 1024px, 768px, 375px
- ✅ Loading state for async data (skeleton or spinner)
- ✅ Empty state when no data
- ✅ Error state when fetch fails
- ✅ Forms have validation feedback (Zod errors shown inline)
- ✅ Buttons have hover and active states
- ✅ Focus rings visible on keyboard navigation
- ✅ All copy in sentence case
- ✅ No emojis except where explicitly allowed (status indicators)
- ✅ No mid-sentence bolding
- ✅ Pricing fields are completely absent for non-admin views
- ✅ All external API calls go through `apiCall()` wrapper

### Critical "do not" list

❌ Don't add a generic Settings page in the sidebar
❌ Don't add Templates as a separate tab in Invoices (it's inside the Settings modal)
❌ Don't show prices to non-admin users — anywhere
❌ Don't write back to Shopify (read-only integration)
❌ Don't convert currencies anywhere — show each currency standalone
❌ Don't add a topbar — use the page-level utility bar instead
❌ Don't add the Unassigned alert to the sidebar — it lives in the bell
❌ Don't show subtitles or "Last sync" stamps under page headings
❌ Don't show signup or Google SSO on login page
❌ Don't show language toggle in the dashboard (English-only)
❌ Don't render an `api_logs` page in the UI (table exists but is admin-only via SQL)
❌ Don't add a role switcher modal — multi-role users see all their nav at once
❌ Don't use serif fonts anywhere
❌ Don't use weight 600 or 700

---

## Appendix: Decision log

These are explicit decisions made during the design phase that may seem unusual without context:

1. **No topbar:** Removed because the user chip is in the sidebar, and the topbar became redundant.
2. **No "Dashboard · Sunday, April 27 · Last sync 2 min ago":** Removed because the page name is in the sidebar (active state) and the sync stamp added no value at the page header.
3. **Right-side login showcase removed:** User explicitly dismissed the marketing column. Login is now centered, simple, and minimal.
4. **English-only dashboard:** No language switcher because the user wants admin/employee interfaces in English. Arabic is for customer-facing PDFs and WhatsApp only.
5. **Invite-only auth:** No signup form, no SSO. Admin invites everyone. Security-first.
6. **No Settings page:** Settings live in-context (Invoices settings inside Invoices, brand assignments inside user dropdown, etc.).
7. **No FX conversion:** Each currency displays standalone. Total payroll and KPIs split by currency, never aggregated to a single value.
8. **Operations (not "Team views"):** Sidebar section name uses operations terminology (matches industry convention).
9. **EU fulfillment (not "Fulfiller"):** Sidebar item names are descriptive of the work, not the role.
10. **api_logs hidden from UI:** Table exists for cost tracking but no admin page renders it; queryable via Supabase SQL editor.
11. **Templates inside Settings modal:** No separate Templates page; managed inside Invoices → Settings → Templates tab.
12. **Bell holds all alerts:** Including Unassigned. Sidebar header stays clean.
13. **JWT-based RLS:** Roles embedded in JWT via Custom Access Token Hook. RLS policies read from `auth.jwt()` instead of querying `user_roles` for 50x performance.
14. **Materialized views for KPIs:** Dashboard KPIs precomputed and refreshed every 5 min via pg_cron. Avoids running 5+ queries on every page load.
15. **Connection pooling required:** App must use Supabase Pooler URL (port 6543) — direct connection (5432) only for migrations.
16. **Optimistic updates everywhere:** Employee actions (Mark purchased, Mark delivered, Pack, Approve invoice) all use React's `useOptimistic` for instant UI feedback.
17. **Virtual scrolling mandatory for > 100 rows:** Orders table, Pipeline, Activity log all use TanStack Virtual.
18. **Notifications archive after 30 days:** Live `notifications` table stays small. Older entries moved to `notifications_archive` by nightly cron.
19. **Reports per currency, never aggregated:** Each currency (SAR, EUR, USD) shown in its own section. No "total" across currencies anywhere.
20. **Offline mode for KSA team:** Service worker + IndexedDB queue for delivery actions. Background sync when network returns.
21. **ISR for Reports/SLA Health/Team Load:** Revalidate every hour. Live pages (Dashboard, Orders) do not use ISR.
22. **TanStack Query for client caching:** All data fetching wrapped in useQuery with 30s staleTime + 5min cache.
23. **Saved Views:** Per-user filter combinations saved as named views (admin power feature).
24. **Inline editing in tables:** Click status badge to edit inline. Avoids round trips to detail pages.
25. **Recent searches in ⌘K:** Last 5 searches stored in localStorage, shown when palette opens empty.

---

**Document version:** 2.0 (added §14 Performance & operational quality)
**Last updated:** April 27, 2026
**Owner:** Ahmed Adel Salah / Optify.cc
**For:** Trendslet OMS
