# Optify OMS — Visual Design Reference

> **Purpose:** Page-by-page visual descriptions of every screen agreed upon during the design phase. This is a companion to the system prompt — read it after reading `OPTIFY_SYSTEM_PROMPT.md`. Use this for layout fidelity when implementing each page.

---

## Reading guide

Each page entry includes:
1. **Route** — the URL path
2. **Who sees it** — which roles can access
3. **Header** — what shows at the top
4. **Body sections** — what fills the content area, in order
5. **Key interactions** — what happens when the user clicks/taps things
6. **Empty state** — what shows when there's no data
7. **Critical rules** — must-follow constraints

---

## Global elements (every page)

### Sidebar (220px, dark `#1A1A1A`, full height)

```
┌──────────────────┐
│  ⬛ T  Trendslet │  ← Logo + store name
│       Main store │  ← (no Unassigned alert here — lives in bell)
│                  │
│  WORKSPACE       │  ← uppercase 10px section label
│  ▶ Dashboard     │  ← active: blue tinted background
│    Orders   1284 │  ← count on the right
│    Invoices   42 │
│    Shipments     │
│    Returns    14 │
│                  │
│  OPERATIONS      │
│    🟡 Sourcing  8│  ← colored dot matches workflow stage
│    🔵 Warehouse 12│
│    🟣 EU fulfill 5│
│    🟢 KSA last-7 │
│                  │
│  INSIGHTS        │
│    SLA health    │
│    Team load     │
│    Payroll       │
│    Reports       │
│                  │
│  ────────────    │  ← divider
│                  │
│  ⬛ Ahmed A.   ▴ │  ← user chip, opens dropdown upward
│     Admin        │
└──────────────────┘
```

### Page utility bar (top-right of content area)

```
                    ┌──────────────────────┬──────┬──────────┐
                    │ 🔍 Search…   ⌘K     │  🔔  │ EN |عربي │
                    └──────────────────────┴──────┴──────────┘
```

- Search box: 280px max width, 5px radius, white card
- Bell: white card, 6px padding, red dot indicator if notifications exist
- Language: white card, "EN" prominent, "| عربي" muted

**Critical:** No page heading "Dashboard" or subtitle in the utility bar. The page title and content live below in the body area.

### User dropdown (opens upward from sidebar)

```
                ┌─────────────────────────────────────┐
                │  ⬛  Ahmed Adel Salah               │
                │      ahmed@optify.cc · Admin        │
                ├─────────────────────────────────────┤
                │  ACCOUNT                            │
                │  ◔ Profile & presence    Online •   │
                │  ⊞ My preferences        EN · SAR   │
                │                                     │
                │  QUEUE                              │
                │  ⚠ Unassigned sub-orders        ❷  │ ← red bg if > 0
                │                                     │
                │  WORKSPACE SETUP                    │
                │  ⊟ Stores                  2 active │
                │  ◇ Brands & assignments    11 brands│
                │  ◉ Team & roles            5 members│
                │  ⌘ Carriers                3 active │
                │  ⇄ Integrations            4 active │
                │  ⊕ Security                2FA on   │
                │                                     │
                │  ──────────────────────────         │
                │  ↗ Sign out                         │ ← red text
                └─────────────────────────────────────┘
```

Background: `#2A2A2A` (slightly lighter than sidebar)
Width: 320px
Profile header: 40px round avatar, name (white 14px / 500), email + role muted

---

## Page 1: Login (`/login`)

**Layout:** Single centered card on light gray background.

```
                                             ┌────────────────────────┐
                                             │  ⬛ T  Trendslet       │
                                             │        Operations Console│
                                             │                        │
                                             │  Welcome back          │
                                             │  Sign in to manage…    │
                                             │                        │
                                             │  Email                 │
                                             │  ┌──────────────────┐  │
                                             │  │ you@trendslet.com│  │
                                             │  └──────────────────┘  │
                                             │                        │
                                             │  Password    Forgot?   │
                                             │  ┌──────────────────┐  │
                                             │  │ ••••••••         │  │
                                             │  └──────────────────┘  │
                                             │                        │
                                             │  ☐ Keep me signed in   │
                                             │     for 30 days        │
                                             │                        │
                                             │  ┌──────────────────┐  │
                                             │  │   Sign in →      │  │ ← navy #042C53
                                             │  └──────────────────┘  │
                                             │                        │
                                             │  ┌──────────────────┐  │
                                             │  │ i Access is      │  │ ← gray banner
                                             │  │   invite-only.   │  │
                                             │  └──────────────────┘  │
                                             │                        │
                                             │  © Optify · Privacy    │
                                             └────────────────────────┘
```

**Critical rules:**
- ❌ No Sign up link
- ❌ No Google SSO
- ❌ No language toggle
- ❌ No marketing/showcase column
- ✅ Centered, simple, premium

---

## Page 2: Admin Dashboard (`/dashboard`)

**Body sections (top to bottom):**

```
Dashboard                                 [🔍 Search] [🔔3] [EN]

┌──────────┬──────────┬──────────┬──────────┬─────────────┐
│ TOTAL    │ ACTIVE   │ DELAYED  │ COMPLETED│ GROSS PROC. │ ← KPI row
│ 1,284    │ 612      │ 47       │ 625      │ SAR 1.8M    │   (5 cards)
│ ↑ 8.2%   │ 7 stages │ 9 risk   │ 94.6%    │ ↑ 14% ░░░░  │   navy on last
└──────────┴──────────┴──────────┴──────────┴─────────────┘

TEAM LOAD · TODAY                                            ← uppercase label
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 🟡 Sourcing  │ 🔵 Warehouse │ 🟣 EU fulfill│ 🟢 KSA last  │
│ 2 members    │ 2 members    │ 1 member     │ 1 member     │
│      8       │      12      │      5       │      7       │
│ to source    │ to pack      │ dual cycle   │ deliveries   │
│ ████░░░ 60%  │ ██████░ 75%  │ ██░░░░░ 40%  │ ████░░░ 50%  │
└──────────────┴──────────────┴──────────────┴──────────────┘

[All 1284] [Active 612] [Delayed 47] [Done 625]   [▤ Table] [⫼ Pipeline]

┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Search   |  Status: 3 ✕  Brand+ Assignee+ Region: US,EU ✕    │
└─────────────────────────────────────────────────────────────────┘

┌────┬──────────┬──────────┬─────┬────────────────┬──────┬─────────┐
│☐   │ Order    │ Customer │Subs │ Status summary │Total │ Alerts  │
├────┼──────────┼──────────┼─────┼────────────────┼──────┼─────────┤
│▸   │ ORD-48210│ Elena V. │ 3/3 │ ▒▒▒▒▒░░░░░░░░░ │ $482 │ Urgent  │ ← red border-left
│    │ Apr 20   │ EU       │     │ 2 Pend  1 Prog │      │         │
│▸   │ ORD-48207│ Fatima A.│ 4/4 │ ▒▒░░▓▓░░██░░░░ │SAR 4k│ SLA risk│
│    │ Apr 22   │ KSA      │     │ multi-status   │      │         │
└────┴──────────┴──────────┴─────┴────────────────┴──────┴─────────┘

Showing 1-25 of 1,284                              ‹ 1 2 3 ... 52 ›
```

**Status summary bar:** A multi-color horizontal bar showing the proportion of sub-orders in each status. Below the bar, an inline list of "● 2 Pending  ● 1 In progress" etc.

---

## Page 3: Orders (`/orders`)

Same as Dashboard's order section but full page, with the KPI row replaced by header text only.

**Pipeline view** (toggle from Table view):

```
Orders                                   [🔍] [🔔] [EN]

[All] [Active] [Delayed] [Done]                    [▤] [⫼ Pipeline]

┌────────────┬────────────┬────────────┬────────────┬────────────┬────────────┐
│ Pending  4 │ In prog  8 │ Purchased 2│ Warehouse 4│ Shipping 4 │ Delivered 7│
├────────────┼────────────┼────────────┼────────────┼────────────┼────────────┤
│┌──────────┐│┌──────────┐│┌──────────┐│┌──────────┐│┌──────────┐│┌──────────┐│
││ORD-48210 │││ORD-48210 │││ORD-48201 │││ORD-48207 │││ORD-48184 │││ORD-48180 ││
││Linen Tee │││Linen Tee │││Cold-press│││Throw     │││Trail Run │││Crew Tee  ││
││Kori Elena│││Kori Layla│││ $119     │││Mesa $310 │││Sable $93 │││$53       ││
│└──────────┘│└──────────┘│└──────────┘│└──────────┘│└──────────┘│└──────────┘│
│┌──────────┐│┌──────────┐│            │┌──────────┐│┌──────────┐│┌──────────┐│
││Sub-03    │││ORD-48207 │││            ││ORD-48198 │││ORD-48184 │││ORD-48204 ││
││🔴 No own ││││Walnut    │││            ││Trouser   │││Beanie    │││Beanie    ││
│└──────────┘││ Delayed  │││            │└──────────┘│└──────────┘│└──────────┘│
│            │└──────────┘│            │            │            │            │
└────────────┴────────────┴────────────┴────────────┴────────────┴────────────┘
```

Cards are draggable between columns (admin only). Empty owners show red border on the card.

---

## Page 4: Unassigned Queue (`/orders/unassigned`)

```
Orders / Unassigned queue
Unassigned sub-orders  [3 waiting]                [Settings] [Auto-assign all]
Sub-orders without an assigned employee. Action required.

⚠ Why are these unassigned?
The brand on the Shopify order doesn't match any active brand assignment.
Either map the brand to a team member, or assign each sub-order manually below.

┌────┬────────────────────────┬─────────┬─────────┬──────┬──────────────┐
│☐   │ Product                │ Brand   │ Order   │Region│ Assign to    │
├────┼────────────────────────┼─────────┼─────────┼──────┼──────────────┤
│☐   │ Walnut Side Table      │ Halcyon │ORD-48207│ EU   │ [Pick…  ▾]   │ ← red border-left
│    │ SUB-48207-07 · 1h ago  │No mapng │Fatima A.│      │              │
├────┼────────────────────────┼─────────┼─────────┼──────┼──────────────┤
│☐   │ Glass Carafe — Amber   │ Mesa    │ORD-48191│ US   │[⬛MR Marco R▾]│ ← preselected
│    │ SUB-48191-11 · 4h ago  │No mapng │Aoife K. │      │              │
├────┼────────────────────────┼─────────┼─────────┼──────┼──────────────┤
│☐   │ Ceramic Pour-over Set  │Northbnd │ORD-48184│ KSA  │ [Pick…  ▾]   │
│    │ SUB-48184-03 · 6h ago  │No mapng │Priya S. │      │              │
└────┴────────────────────────┴─────────┴─────────┴──────┴──────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ Permanent fix · Map a brand to a team member                        │
│ When you map a brand, all current and future sub-orders auto-assign.│
│                                                                     │
│ [Select brand…  ▾]   →   [Select employee…  ▾]   [Map]              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Page 5: Invoices (`/invoices`)

```
Invoices                                          [⚙ Settings]
Customer invoices · review and approve before sending

[Pending review 8] [Approved 24] [Sent 612]

┌────────────┬────────────┬────────────────┬─────────────────┐
│ AWAITING   │ AVG TIME   │ AI ACCURACY 30D│ PENDING VALUE   │
│    8       │   14m      │   87%          │ SAR 14,820      │
│            │            │ ↑ 3% with corr │ across 8 drafts │ ← navy
└────────────┴────────────┴────────────────┴─────────────────┘

[🔍 Search] [Brand+] [Employee+] [⚠ AI conf: low ✕]    Sort: Oldest ▾

┌─ Low confidence (orange border) ───────────────────────────────────┐
│ INV-2026-000142  [Low AI confidence]              [⬛EV] Elena V. │
│ From order ORD-48210 · 23 min ago by Marco R.                      │
│                                                                    │
│ Line items · 3                          Calculation                │
│ ┌─────────────────────────┐             ┌──────────────────┐       │
│ │ Linen Crew Tee   €68 412│             │ Cost   €277      │       │
│ │ Structured Tote  €124 752│             │ FX → SAR 1,135  │       │
│ │⚠ Trouser 62%     €85 516│ ← red bg    │ Markup 50% +568 │       │
│ └─────────────────────────┘             │ Shipping  +25    │       │
│                                          │ VAT 15%  +259    │       │
│                                          │ ─────────────    │       │
│                                          │ Total SAR 1,987  │       │
│                                          │ Profit SAR 568   │       │
│                                          └──────────────────┘       │
│                                                                    │
│ [✓ Approve & send]  [Edit prices]  [Preview PDF]    [Reject]      │
└────────────────────────────────────────────────────────────────────┘

┌─ High confidence (green border, collapsed) ────────────────────────┐
│ INV-2026-000141  [High] 94%  ORD-48207 · 2 items · Hiro T.        │
│                                          SAR 1,240  Profit 380     │
│                                                  [Approve]    ▾   │
└────────────────────────────────────────────────────────────────────┘

┌── Bulk approve banner (navy) ─────────────────────────────────────┐
│ 5 high-confidence invoices ready for bulk approval                │
│                                              [Approve all (5) →] │
└───────────────────────────────────────────────────────────────────┘
```

---

## Page 6: Invoice Detail (`/invoices/[id]`)

**2-column grid:**

```
Invoices / Pending review / INV-2026-000142
INV-2026-000142  [Pending] [Low AI conf]   [Reject] [Edit] [✓ Approve & send]

┌──────────────────────────────┬────────────────────────┐
│ PDF preview          [⤓ ↗]   │ Calculation            │
│ ┌──────────────────────────┐ │ Cost     €277          │
│ │ ⬛T          INVOICE      │ │ FX → SAR 1,135         │
│ │             INV-...      │ │ Markup 50%  +568       │
│ │  BILL TO Elena Varga     │ │ Shipping     +25       │
│ │  King Fahd Road, Riyadh  │ │ VAT 15%     +259       │
│ │                          │ │ ─────────────────      │
│ │  Linen Crew Tee  SAR 412 │ │ Total  SAR 1,987       │
│ │  Structured Tote SAR 752 │ │ Profit SAR 568 (29%)   │
│ │  Relaxed Trouser SAR 516 │ ├────────────────────────┤
│ │  ──────────────          │ │ Customer               │
│ │  Total      SAR 1,987    │ │ ⬛EV Elena Varga       │
│ │                          │ │     elena.v@example…   │
│ │   ‹ Page 1 of 1 ›        │ │ King Fahd Road…        │
│ └──────────────────────────┘ ├────────────────────────┤
├──────────────────────────────┤ History                │
│ Line items · 3               │ • Generated by Marco R.│
│ [table same as list view]    │   23 min ago           │
├──────────────────────────────┤ • Items mapped         │
│ AI reasoning                 │   25 min ago           │
│ Why the AI made decisions    │ • Receipt uploaded     │
│ ✓ Linen 96% — exact match    │   1h ago               │
│ ✓ Tote 91% — SKU match       │                        │
│ ⚠ Trouser 62% — color partial│                        │
└──────────────────────────────┴────────────────────────┘
```

---

## Page 7: Sourcing employee view (`/queue` for sourcing role)

```
Sourcing · US                                       [⬛MR] Marco R.

┌────────────────────────────────────────────────────────┐
│ Good morning, Marco                                    │
│ You have 8 items to source today across 3 brands       │
│                                                        │
│ ┌────────┬────────┬────────────┐                       │
│ │ TO DO  │ DONE   │ OUT OF STK │                       │
│ │   8    │   5    │     1      │                       │
│ └────────┴────────┴────────────┘                       │
└────────────────────────────────────────────────────────┘

[My queue · 8] [Upload invoice] [History]

┌─ Urgent (red border) ────────────────────────────────────┐
│ SUB-48210-00  [Urgent · SLA 4h]              ORD-48210  │
│                                                          │
│ ⬛img  Linen Crew Tee — Bone                            │
│        Brand: Kori · Size M · Qty 1                     │
│                                                          │
│ [Mark as purchased online]  [In-store]  [Out of stock]  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ SUB-48207-09                                  ORD-48207 │
│                                                          │
│ ⬛img  Trail Runner GT M10                              │
│        Brand: Sable · Size 42 · Qty 1                   │
│                                                          │
│ [Mark as purchased online]  [In-store]  [Out of stock]  │
└──────────────────────────────────────────────────────────┘
```

**No prices visible.** Each task card has primary action (navy) + secondary options.

---

## Page 8: Warehouse employee view (`/pipeline` for warehouse role)

```
Warehouse · US                                      [⬛HT] Hiro T.

Warehouse pipeline
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ INCOMING    │ AT WAREHSE  │ PACKING     │ SHIPPED TODAY│
│     12      │     7       │     4       │     9        │
│ Purchased   │ Ready pack  │ In progress │ Sent to DHL  │
└─────────────┴─────────────┴─────────────┴─────────────┘

[Incoming 12] [At warehouse 7] [Packing 4] [Export CSV]

┌── Bulk action bar (navy, when items selected) ──────────┐
│ 3 selected · Move all to packing?       [Move →]        │
└─────────────────────────────────────────────────────────┘

┌──┬──────────┬──────────────────────────┬──────┬─────────┬──────┐
│☐ │ Sub      │ Product                  │Brand │ Arrived │ Action│
├──┼──────────┼──────────────────────────┼──────┼─────────┼──────┤
│☑ │ -48207-05│ Organic Throw — Ecru     │ Mesa │ 2h ago  │[Pack]│
│☑ │ -48198-03│ Relaxed Trouser — Olive  │Sable │ 4h ago  │[Pack]│
│☐ │ -48184-09│ Trail Runner GT M10      │Sable │ 5h ago  │[Pack]│
└──┴──────────┴──────────────────────────┴──────┴─────────┴──────┘
```

Compact table (warehouse handles volume). Selected rows highlighted.

---

## Page 9: Fulfiller view (EU role)

```
Fulfiller · EU                                   [⬛FW] Fernweh M.

┌─────────────────────────────┬─────────────────────────────┐
│ 🟡 Sourcing cycle           │ 🔵 Warehouse cycle          │
│ Items waiting to buy        │ Items received and ready    │
│ Pending: 3  In progress: 2  │ Received: 3  Packing: 0     │
│                  [5 to do]  │                  [3 to do]  │
└─────────────────────────────┴─────────────────────────────┘

[🟡 Sourcing 5] [🔵 Warehouse 3] [All 8] [History]

┌──────────────────────────────────────────────────────────┐
│ SUB-48201-04 [Pending]                       ORD-48201   │
│ ⬛img  Ceramic Pour-over Set                            │
│        Brand: Fernweh · Size: standard · Qty 1          │
│                                                          │
│ [Mark as purchased]                    [Out of stock]   │
└──────────────────────────────────────────────────────────┘
```

Two cycle summary cards on top. Active tab color matches its cycle. Cards switch styling depending on active tab.

---

## Page 10: KSA Last-mile (`/deliveries` for ksa_operator)

```
Last-mile · KSA                                      [⬛YA] Yusef A.

┌──────────────────────────────────────────────────────────┐
│ السلام عليكم يوسف                  [+ Receive shipment] │
│ 7 deliveries today across Riyadh                         │
│                                                          │
│ ┌────────┬────────┬────────┬────────┐                    │
│ │ARRIVED │ OUT FOR│DELIVRD │RETURNS │                    │
│ │   3    │   4    │  12    │   1    │                    │
│ └────────┴────────┴────────┴────────┘                    │
└──────────────────────────────────────────────────────────┘

[Arrived 3] [Out for delivery 4] [History]

┌── Purple border ─────────────────────────────────────────┐
│ ⬛FA Fatima Al-Harbi                            [SLA 2h] │
│      SUB-48207-05                                        │
│                                                          │
│ ┌───────────────────────────────────────────────┐        │
│ │ 📍 Delivery address                           │        │
│ │ King Fahd Road, Al Olaya                      │        │
│ │ Building 7234, Apt 12 · Riyadh 12243          │        │
│ │ 📞 +966 50 xxx 4421 | 3 items · COD           │        │
│ └───────────────────────────────────────────────┘        │
│                                                          │
│ [✓ Mark as delivered]    [📞 Call]   [Return]           │
└──────────────────────────────────────────────────────────┘
```

**Mobile-first design.** Address is tappable (opens Google Maps). Phone tappable (triggers `tel:` link).

---

## Page 11: Payroll (`/payroll`)

```
Payroll                                       [↻ Sync now] [Export CSV]
Hours pulled from Hubstaff · last sync 12 min ago

┌─ Period ────────────────────────────────────────────────────┐
│ [This week] [Last 2 weeks] [This month] [Custom]            │
│ Apr 13 — Apr 27                  5 employees · 14 days      │
└─────────────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────────┬──────────────────┐
│ HOURS    │ AVG/DAY  │ ACTIVE EMP   │ TOTAL PAYROLL    │
│ 347.5h   │ 24.8h    │     5        │ Mixed currencies │ ← navy
└──────────┴──────────┴──────────────┴──────────────────┘

┌──┬──────────────┬──────────┬───────┬─────────┬──────────┬──┐
│  │ Employee     │ Role     │ Hours │ Rate    │ Total    │⋯ │
├──┼──────────────┼──────────┼───────┼─────────┼──────────┼──┤
│⬛│ Marco Rivera │ Sourcing │ 82.5h │ $5.00   │ $412.50  │⋯ │
│MR│ marco@... US │          │       │         │          │  │
│⬛│ Hiro Tanaka  │ Warehouse│ 76.0h │ $6.00   │ $456.00  │⋯ │
│⬛│ Fernweh M.   │ Fulfiller│ 68.5h │ €7.00   │ €479.50  │⋯ │ ← EUR
│⬛│ Yusef A.     │ Last-mile│ 85.0h │ SAR 25  │ SAR 2,125│⋯ │ ← SAR
│⬛│ Nadia S.     │ Sourcing │ 35.5h │ $5.50   │ $195.25  │⋯ │
└──┴──────────────┴──────────┴───────┴─────────┴──────────┴──┘

Each currency shown standalone — no conversion applied.
```

**Critical:** Each employee's currency stays separate. KPI "Total payroll" displays "Mixed currencies" because there's no FX conversion.

---

## Page 12: Notifications panel

Triggered by clicking 🔔 in the page utility bar. Opens as 380px popover.

```
                    ┌─────────────────────────────┐
                    │ Notifications  ⚙  Mark all r│
                    │ [All 12] [Unread 3] [Mention]│
                    ├─────────────────────────────┤
                    │ ┌─ Red bg ─────────────────┐│
                    │ │ 3 sub-orders unassigned •│ │
                    │ │                       Now │ │
                    │ │ Halcyon, Mesa, Northbound │ │
                    │ └───────────────────────────┘│
                    │ ┌─ Orange border ──────────┐ │
                    │ │ Order ORD-48207 at risk •│ │
                    │ │                      12m │ │
                    │ │ SLA breach in <2h        │ │
                    │ └───────────────────────────┘│
                    │ ┌─ Blue border ────────────┐ │
                    │ │ 8 invoices pending     • │ │
                    │ │                       1h │ │
                    │ │ 5 high-confidence ready  │ │
                    │ └───────────────────────────┘│
                    │                              │
                    │ EARLIER TODAY                │
                    │ Order ORD-48204 delivered 3h │
                    │ 5 new orders from Shopify 5h │
                    │ Hubstaff sync completed   8h │
                    ├─────────────────────────────┤
                    │ View all notifications →    │
                    └─────────────────────────────┘
```

Unread items have red dot. Severity shown by colored left border.

---

## Page 13: Command palette (⌘K)

Triggered by ⌘K or clicking Search box.

```
                        ┌─────────────────────────────┐
                        │ 🔍 elena                 esc│
                        ├─────────────────────────────┤
                        │ CUSTOMERS · 2               │
                        │ ⬛EV ▒Elena▒ Varga       ↵  │ ← match highlighted
                        │     elena.v@... 3 ord EU    │
                        │ ⬛EM ▒Elena▒ Mahmoud        │
                        │     e.mahmoud@... 1 ord KSA │
                        │                             │
                        │ ORDERS · 3                  │
                        │ ≡ ORD-48210                 │
                        │   ▒Elena▒ Varga $482 [Pend] │
                        │ ≡ ORD-48156                 │
                        │   ▒Elena▒ Varga $328 [Deliv]│
                        │                             │
                        │ QUICK ACTIONS               │
                        │ + Create new order for elena│
                        ├─────────────────────────────┤
                        │ ↑↓ Navigate ↵ Select ⌘K End │
                        └─────────────────────────────┘
```

---

## Page 14: Activity log (`/activity-log`)

```
Activity log                                            [Export]
Every action across the system · last 90 days

[🔍 Search] [User+] [Action: status_change ✕] [Resource+] [Date+]

──── TODAY · APRIL 27 ────────────────────────────────────────────────

⬛AS  Ahmed A.      Approved invoice INV-2026-000141      2 min ago
      Admin         Customer: Elena Varga · Total: SAR 1,240

⬛MR  Marco R.      Changed SUB-48210-00 from [pending]   14 min ago
      Sourcing      to [in_progress]
                    Linen Crew Tee · Kori

⬛YA  Yusef A.      Marked SUB-48204-01 as [delivered]    3h ago
      Last-mile     To: Chen Wei · Riyadh

⬛AS  Ahmed A.      Mapped brand Halcyon to Marco R.      5h ago
      Admin         Region: US · Auto-assigns future

⬛⚙   System        Imported 5 new orders from Shopify    5h ago
                    Auto-routed to Sourcing (3) and EU (2)

──── YESTERDAY · APRIL 26 ──────────────────────────────────────────

⬛AS  Ahmed A.      Invited Nadia S. to join as           Yesterday
      Admin         Sourcing · US
                    nadia@trendslet.com · accepted in 2h

Showing 6 of 248 events                              Load more →
```

System events use ⚙ icon instead of avatar.

---

## Page 15: Reports (`/reports`)

```
Reports                                  [Last 30 days ▾] [Export]
Performance, revenue, and team analytics

┌──────────┬──────────┬──────────┬──────────────┐
│ REVENUE  │ PROFIT   │ FULFILLED│ AVG TIME     │
│ SAR 482k │ SAR 142k │   387    │  5.4 days    │
│ ↑ 24%    │ 29.4% mg │ 94.6% OT │ ↓ 0.8d       │
└──────────┴──────────┴──────────┴──────────────┘

┌─ Revenue over time ─────────────────────────────────────┐
│ Daily, last 30 days       [● Revenue] [● Profit]        │
│                                                         │
│           ▁▁▂▂▃▃▃▄▄▄▅▅▅▆▆▆▆▇▇▇█████          │ ← stacked bars
│ Mar 28   Apr 4   Apr 11   Apr 18   Apr 27               │
└─────────────────────────────────────────────────────────┘

┌─ Top brands ──────────────────────┬─ Team performance ─────────────┐
│ By revenue · last 30 days         │ Sub-orders completed · 30 days │
│                                   │                                │
│ Kori       SAR 142k ████████████  │ ⬛MR Marco Rivera   96.4% on-T │
│ Sable      SAR 98k  ████████░░░░  │      Sourcing 142 items        │
│ Fernweh    SAR 76k  ██████░░░░░░  │ ⬛HT Hiro Tanaka    98.1% on-T │
│ Northbound SAR 64k  █████░░░░░░░  │      Warehouse 138 items       │
│ Mesa       SAR 48k  ████░░░░░░░░  │ ⬛FW Fernweh M.     92.8% on-T │
│                                   │      Fulfiller 84 items        │
│                                   │ ⬛YA Yusef A.       94.6% on-T │
│                                   │      Last-mile 124 deliveries  │
└───────────────────────────────────┴────────────────────────────────┘
```

---

## Mobile patterns

### Mobile sidebar replacement (bottom nav)

```
┌──────────────────────────────────────┐
│  ☰  Trendslet                  🔔   │ ← hamburger top bar
│  ────────────────────────────────    │
│                                      │
│  [Page content]                      │
│                                      │
│  ────────────────────────────────    │
│                                      │
│  ⌂      ≡       +      ☰    👤      │ ← bottom nav (5 icons)
│ Home  Orders  Add   More  Profile    │
└──────────────────────────────────────┘
```

### Mobile cards (instead of tables)

Each row in a desktop table becomes a vertically stacked card on mobile:

```
┌──────────────────────────────┐
│ ORD-48210                    │
│ Elena Varga · 3 sub-orders   │
│ ▒▒▒▒▒░░░░░░░░░░░░░░          │ ← status bar
│ 2 Pending · 1 In progress    │
│                       $482   │
│ [Unassigned] [Urgent]        │
└──────────────────────────────┘
```

---

## Print styles (for invoices)

When PDF rendering or printing, the design switches to:
- White background
- Black text (12-14px serif optional)
- Logo in top-left
- Bilingual support based on template language
- A4 page size with 20mm margins

---

## Accessibility

- All interactive elements: 44x44px minimum touch target
- Focus rings visible on keyboard nav (2px navy outline)
- Color contrast: 4.5:1 for body text, 3:1 for large text
- ARIA labels on all icon-only buttons
- Skip-to-content link for keyboard users
- Semantic HTML: `<nav>`, `<main>`, `<aside>`, etc.
- Form errors announced via `aria-live`

---

**Visual reference version:** 1.0
**Last updated:** April 27, 2026
**For:** Trendslet OMS by Optify.cc
