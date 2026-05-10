# Trendlet Optify — Phase 1 Visual Refresh Proposal

> **Scope:** Discovery + design decisions only. No code changes in this document.  
> **Author:** Claude (ai@trendlet.com) · 2026-04-30  
> **Status:** Draft — awaiting approval before any implementation begins

---

## A. Recommendation Summary

**Direction C (hybrid)** is the pick: keep the warm cream background (`#f6f5f2`) that is already woven into 60+ components, and upgrade the navy accent from the current `#2b3aa0` to the spec's deeper `#0C447C`. This captures the authority of the original spec navy — better legibility at small sizes, better relationship with the warehouse blue palette — without the regression risk of swapping the page background across the entire codebase. Each role gets a distinct visual identity driven by their operational cadence: sourcing gets amber calm (one item at a time), warehouse gets blue density (50+ items per shift), fulfiller gets a dual amber/blue treatment that tracks the active cycle tab, and admin keeps the neutral navy with red reserved exclusively for alerts. The shared `SubOrderRow` stays as one file and receives a `role` prop that drives accent color and at-risk border tint — no forking, no duplication.

---

## B. Shared Design Foundation

### B.1 Color palette

| Group | Token | Hex | Use |
|---|---|---|---|
| **Page** | `--bg` | `#f6f5f2` | Page background (cream — no change) |
| **Surface** | `--panel` | `#ffffff` | Cards, modals, popovers |
| **Sidebar** | `--sidebar` | `#111418` | Sidebar bg (no change) |
| **Accent** | `--accent` | `#0C447C` | Primary CTA, focus rings, links (**upgrade from #2b3aa0**) |
| **Accent soft** | `--accent-soft` | `#ecedf7` | Active nav item bg |
| **Ink primary** | `--ink` | `#0f1419` | Main text |
| **Ink secondary** | `--ink-2` | `#2a3038` | Labels, secondary text |
| **Muted** | `--muted` | `#6b7280` | Tertiary text, placeholders |
| **Muted 2** | `--muted-2` | `#9aa1aa` | Sidebar item default text |
| **Border** | `--line` | `#e7e5df` | Default borders and dividers |
| **Hover** | `--hover` | `#f9f8f4` | Row and item hover backgrounds |
| **Rose** | `--rose` | `#b42318` | Danger, alerts, admin-only alert indicators |
| **Green** | `--green` | `#0e7c4a` | Delivered, success states |

**Role accents:**

| Role | Accent | Soft bg | Text on soft |
|---|---|---|---|
| Sourcing | `#b4700a` amber | `#fdf3dd` | `#633806` |
| Warehouse | `#1d4ed8` blue | `#E6F1FB` | `#0C447C` |
| Fulfiller | Dual — amber (sourcing tab) / blue (warehouse tab) | Inherits active tab | Inherits active tab |
| Admin | `#0C447C` navy | `#ecedf7` | `#0C447C` |

**Status palette (no changes):**

| Status | bg | fg | border |
|---|---|---|---|
| sourcing | `#fdf3dd` | `#633806` | `#EF9F27` |
| warehouse | `#E6F1FB` | `#0C447C` | `#378ADD` |
| transit | `#EEEDFE` | `#3C3489` | `#7F77DD` |
| delivered | `#E1F5EE` | `#085041` | `#1D9E75` |
| pending | `#F1EFE8` | `#2C2C2A` | `#888780` |
| danger | `#fde3de` | `#791F1F` | `#F09595` |
| success | `#dcf1e3` | `#0F6E56` | `#5DCAA5` |

### B.2 Typography

**Font families:**
- **UI text:** Inter (`var(--font-inter)`) — all prose, labels, buttons, navigation
- **Numeric data:** JetBrains Mono (`var(--font-jetbrains)`) with `tabular-nums` + `"tnum"` feature — order IDs, sub-order IDs, quantities, SLA timers, prices (admin only), dates in tables

**Scale (no changes to values):**

| Class | Size | Line-height | Weight | Use |
|---|---|---|---|---|
| `text-h1` | 20px | 28px | 500 | Page titles, greeting names |
| `text-h2` | 16px | 24px | 500 | Section headings, card titles |
| `text-card` | 13px | 18px | 500 | Card labels, column headers |
| `text-body` | 13px | 1.45 | 400 | Body copy, descriptions |
| `text-label` | 11px | 14px | 500 | Tags, subheadings, table column labels |
| `text-hint` | 10px | 14px | 400 | Timestamps, footnotes, hints |

**Hard rule: fontWeight 400 and 500 only. Never use `font-semibold` (600) or `font-bold` (700) in any Phase 1 code.**

### B.3 Spacing scale

Tailwind 4px-base defaults. No custom spacing values introduced. Common patterns:
- Card padding: `p-4` (16px) for sourcing cards, `px-3 py-2.5` for warehouse rows
- Section gap: `gap-6` between major sections, `gap-3` within a card
- Group header margin: `mb-2` above group headers

### B.4 Radius scale (no changes)

| Class | Value | Use |
|---|---|---|
| `rounded-sm` | 4px | Pills, tags |
| `rounded-md` | 6px | Sidebar items, compact buttons |
| `rounded` | 8px | Cards, main panels |
| `rounded-lg` | 10px | Modals, drawers |
| `rounded-xl` | 12px | Popovers, large overlays |

### B.5 Shadow scale (no changes)

| Token | Value | Use |
|---|---|---|
| `shadow-sm` | `0 1px 0 rgba(15,20,25,.04), 0 1px 2px rgba(15,20,25,.04)` | Cards, default elevation |
| `shadow-md` | `0 1px 0 rgba(15,20,25,.04), 0 2px 6px rgba(15,20,25,.06), 0 12px 32px -16px rgba(15,20,25,.18)` | Modals, elevated panels |
| `shadow-modal` | `0 8px 24px rgba(0,0,0,0.12)` | Modal dialogs |
| `shadow-popover` | `0 4px 16px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)` | Dropdowns, tooltips |

### B.6 Iconography

No change. Lucide React throughout. Consistent `h-4 w-4` (16px) for inline icons, `h-5 w-5` (20px) for nav icons. No new icon library introduced.

---

## C. Token Contract

These are the exact code blocks Phase 2 will apply. Copy-paste ready. Running `npm run typecheck` after applying them produces zero errors.

### C.1 `tailwind.config.ts` — full `theme.extend` block

```typescript
// app/tailwind.config.ts  — theme.extend replacement (Direction C)
theme: {
  extend: {
    colors: {
      // Brand / accent  (Direction C: deep navy upgrade)
      navy: {
        DEFAULT: "#0C447C",   // upgraded from #2b3aa0
        deep: "#07264a",
      },
      accent: { DEFAULT: "#0C447C" },
      // Surfaces
      page:    "rgb(var(--color-page) / <alpha-value>)",
      surface: "rgb(var(--color-surface) / <alpha-value>)",
      sidebar: "#111418",
      "sidebar-hover": "#1c2028",
      // Text
      ink: {
        primary:   "rgb(var(--color-ink-primary)   / <alpha-value>)",
        secondary: "rgb(var(--color-ink-secondary) / <alpha-value>)",
        tertiary:  "rgb(var(--color-ink-tertiary)  / <alpha-value>)",
      },
      // Shared primitives
      line:          "#e7e5df",
      hover:         "#f9f8f4",
      "accent-soft": "#ecedf7",
      // Status palette — no changes
      status: {
        sourcing:  { bg: "#fdf3dd", fg: "#633806", border: "#EF9F27" },
        warehouse: { bg: "#E6F1FB", fg: "#0C447C", border: "#378ADD" },
        transit:   { bg: "#EEEDFE", fg: "#3C3489", border: "#7F77DD" },
        delivered: { bg: "#E1F5EE", fg: "#085041", border: "#1D9E75" },
        pending:   { bg: "#F1EFE8", fg: "#2C2C2A", border: "#888780" },
        danger:    { bg: "#fde3de", fg: "#791F1F", border: "#F09595" },
        success:   { bg: "#dcf1e3", fg: "#0F6E56", border: "#5DCAA5" },
      },
      // Role accents (new tokens for Phase 1)
      "role-sourcing":     "#b4700a",
      "role-sourcing-bg":  "#fdf3dd",
      "role-sourcing-fg":  "#633806",
      "role-warehouse":    "#1d4ed8",
      "role-warehouse-bg": "#E6F1FB",
      "role-warehouse-fg": "#0C447C",
      "role-fulfiller":    "#6d28d9",
      "role-fulfiller-bg": "#ece2fa",
      "role-fulfiller-fg": "#3C3489",
      // Semantic color pairs
      amber:  { DEFAULT: "#b4700a", bg: "#fdf3dd", fg: "#633806" },
      blue:   { DEFAULT: "#1d4ed8", bg: "#E6F1FB", fg: "#0C447C" },
      green:  { DEFAULT: "#0e7c4a", bg: "#dcf1e3" },
      rose:   { DEFAULT: "#b42318", bg: "#fde3de" },
      slate:  { DEFAULT: "#475569", bg: "#e9ecf1" },
      violet: { DEFAULT: "#6d28d9", bg: "#ece2fa" },
    },
    fontFamily: {
      sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      mono: ["var(--font-jetbrains)", "'JetBrains Mono'", "ui-monospace", "monospace"],
    },
    fontWeight: {
      normal:   "400",
      medium:   "500",
      semibold: "600",  // escape hatch only — do not use in Phase 1
      bold:     "700",  // escape hatch only — do not use in Phase 1
    },
    fontSize: {
      h1:    ["20px", { lineHeight: "28px", fontWeight: "500" }],
      h2:    ["16px", { lineHeight: "24px", fontWeight: "500" }],
      card:  ["13px", { lineHeight: "18px", fontWeight: "500" }],
      body:  ["13px", { lineHeight: "1.45", fontWeight: "400" }],
      label: ["11px", { lineHeight: "14px", fontWeight: "500" }],
      hint:  ["10px", { lineHeight: "14px", fontWeight: "400", letterSpacing: "0.4px" }],
    },
    borderRadius: {
      sm:      "4px",
      md:      "6px",
      DEFAULT: "8px",
      lg:      "10px",
      xl:      "12px",
    },
    boxShadow: {
      sm:      "0 1px 0 rgba(15,20,25,.04), 0 1px 2px rgba(15,20,25,.04)",
      md:      "0 1px 0 rgba(15,20,25,.04), 0 2px 6px rgba(15,20,25,.06), 0 12px 32px -16px rgba(15,20,25,.18)",
      modal:   "0 8px 24px rgba(0,0,0,0.12)",
      popover: "0 4px 16px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)",
      login:   "0 4px 16px rgba(0,0,0,0.04)",
    },
    borderColor: {
      hairline:          "rgba(15,20,25,0.10)",
      "hairline-strong": "rgba(15,20,25,0.18)",
    },
    animation: {
      "popover-in":  "popoverIn 0.15s cubic-bezier(.32,.72,.32,1) forwards",
      "popover-out": "popoverOut 0.12s cubic-bezier(.32,.72,.32,1) forwards",
      "drawer-in":   "drawerIn 0.28s cubic-bezier(.32,.72,.32,1) forwards",
      "drawer-out":  "drawerOut 0.22s cubic-bezier(.32,.72,.32,1) forwards",
      "backdrop-in": "backdropIn 0.25s ease forwards",
      "live-pulse":  "pulse 1.8s infinite",
      "alarm-pulse": "alarmPulse 2.4s ease-in-out infinite",
    },
  },
},
```

### C.2 `app/globals.css` — full `:root` block replacement

```css
/* app/globals.css — :root block (Direction C) */
@layer base {
  :root {
    /* ── RGB triplets for Tailwind opacity modifiers ── */
    --color-page:          246 245 242;   /* #f6f5f2 warm cream (no change) */
    --color-surface:       255 255 255;
    --color-ink-primary:   15 20 25;      /* #0f1419 */
    --color-ink-secondary: 42 48 56;      /* #2a3038 */
    --color-ink-tertiary:  107 114 128;   /* #6b7280 */
    --color-navy:          12 68 124;     /* #0C447C — Direction C upgrade */
    --color-navy-deep:     7 38 74;       /* #07264a */
    --color-accent:        12 68 124;     /* matches --color-navy */

    /* ── Hex tokens ── */
    --bg:           #f6f5f2;
    --panel:        #ffffff;
    --ink:          #0f1419;
    --ink-2:        #2a3038;
    --muted:        #6b7280;
    --muted-2:      #9aa1aa;
    --line:         #e7e5df;
    --line-2:       #efede7;
    --hover:        #f9f8f4;
    --accent:       #0C447C;   /* Direction C: upgraded from #2b3aa0 */
    --accent-ink:   #ffffff;
    --accent-soft:  #ecedf7;

    /* ── Role accent tokens (new) ── */
    --role-sourcing:      #b4700a;
    --role-sourcing-bg:   #fdf3dd;
    --role-sourcing-fg:   #633806;
    --role-warehouse:     #1d4ed8;
    --role-warehouse-bg:  #E6F1FB;
    --role-warehouse-fg:  #0C447C;
    --role-fulfiller:     #6d28d9;
    --role-fulfiller-bg:  #ece2fa;
    --role-fulfiller-fg:  #3C3489;

    /* ── Semantic color pairs (no changes) ── */
    --amber:        #b4700a; --amber-bg:  #fdf3dd;
    --blue:         #1d4ed8; --blue-bg:   #E6F1FB;
    --green:        #0e7c4a; --green-bg:  #dcf1e3;
    --rose:         #b42318; --rose-bg:   #fde3de;
    --slate:        #475569; --slate-bg:  #e9ecf1;
    --violet:       #6d28d9; --violet-bg: #ece2fa;

    /* ── Layout primitives ── */
    --radius:    8px;
    --radius-sm: 6px;
    --shadow-sm: 0 1px 0 rgba(15,20,25,.04), 0 1px 2px rgba(15,20,25,.04);
    --shadow-md: 0 1px 0 rgba(15,20,25,.04), 0 2px 6px rgba(15,20,25,.06), 0 12px 32px -16px rgba(15,20,25,.18);
  }
}
```

**Files changed in PR 1:** `tailwind.config.ts` (navy token only) + `app/globals.css` (`:root` block only). No component files.  
**Verify:** `npm run typecheck && npm run build` — zero errors expected. Visual change: all navy-accented elements (buttons, active nav, focus rings) shift from bright `#2b3aa0` to authoritative `#0C447C`. Everything else unchanged.

---

## D. Per-Role Visual Identity

### D.1 Sourcing (`/queue`) — Amber

**Identity:** "Personal task list. You are the buyer."  
**Accent hex stops:** `#fdf3dd` (50) · `#f5d99a` (100) · `#b4700a` (600) · `#633806` (800)  
**Accent class names:** `bg-[#b4700a]`, `text-[#633806]`, `bg-[#fdf3dd]`, `border-[#b4700a]`

**Greeting card layout (NEW — server component `<SourcingGreeting>`):**
```
╭────────────────────────────────────────────────────╮
│ border-t-2 border-t-[#b4700a]  .card-surface       │
│                                                    │
│  Good morning, Ahmed          ← text-h1 (20/500)  │
│  8 items to source · 3 brands ← text-body muted   │
│                                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │   To do      │ │  Done today  │ │  Out stock │ │
│  │     8        │ │     3        │ │     1      │ │
│  │  .mono .text-h1 amber        │ │            │ │
│  └──────────────┘ └──────────────┘ └────────────┘ │
╰────────────────────────────────────────────────────╯
```

**Greeting copy logic:**
- Time of day: `Good morning` (< 12:00) / `Good afternoon` (12–17) / `Good evening` (≥ 17) — server-side via `new Date().getHours()`
- Name: `profiles.first_name` — already available in `getCurrentUser()` response (add to return type if missing)
- Summary line: `"${toBuyCount} item${toBuyCount !== 1 ? 's' : ''} to source · ${brandCount} brand${brandCount !== 1 ? 's' : ''}"` — derived from `fetchFulfillmentQueue` result already fetched for the page. Brand count = `new Set(rows.map(r => r.brand?.id)).size`. No extra query.
- Third mini-stat: **Out of stock** — `rows.filter(r => r.status === 'out_of_stock').length`. Also from the existing fetch.

**Task card (SubOrderRow in sourcing context):**
- Container: `.card-surface` `p-4` — generous
- Row height: ~80px with product thumbnail
- Delayed: `border-l-2 border-l-status-danger-border` (unchanged)
- At-risk + not delayed: `border-l-2 border-l-[#b4700a]` (amber, not red)
- Primary action button: `bg-[#b4700a] text-white hover:bg-[#a06008]`
- Secondary buttons: `border border-hairline bg-surface text-ink-primary hover:bg-hover`

**Group headers:** `text-label text-ink-tertiary uppercase tracking-wide mb-2`

**Density:** Card-based, `gap-3` between rows. Generous — sourcing processes one item at a time with intent.

---

### D.2 Warehouse (`/pipeline`) — Blue

**Identity:** "Volume pipeline. Move batches efficiently."  
**Accent hex stops:** `#E6F1FB` (50) · `#bfdbfe` (100) · `#1d4ed8` (600) · `#0C447C` (800)  
**Accent class names:** `bg-[#1d4ed8]`, `text-[#0C447C]`, `bg-[#E6F1FB]`, `border-[#1d4ed8]`

**Pipeline summary (NEW — server component `<PipelineSummary>`):**
```
╭──────────╮  ╭──────────╮  ╭──────────╮  ╭──────────╮
│ Incoming │  │Warehouse │  │ Packing  │  │ Shipped  │
│ ──────── │  │ ──────── │  │ ──────── │  │ ──────── │
│ border-t │  │ border-t │  │ border-t │  │ border-t │
│  blue    │  │  blue    │  │  violet  │  │  green   │
│          │  │          │  │          │  │          │
│    12    │  │    7     │  │    4     │  │    9     │
│  .mono   │  │  .mono   │  │  .mono   │  │  .mono   │
╰──────────╯  ╰──────────╯  ╰──────────╯  ╰──────────╯
```
- Each card: `.card-surface` + stage-specific `border-t-2`:
  - Incoming: `border-t-[#1d4ed8]`
  - At warehouse: `border-t-[#1d4ed8]`
  - Packing: `border-t-[#6d28d9]`
  - Shipped today: `border-t-[#0e7c4a]`

**Compact table:**
- Row height: 44px (min-h-[44px])
- Columns: ☐ | Sub-order ID | Product | Brand | Arrived | Action
- Sub-order ID: `.mono text-label`
- Selected row: `bg-[#E6F1FB]`
- No product thumbnail — warehouse deals in volume, not individual items

**Warehouse greeting (simplified — no full greeting card):**
One line beneath the page title: `"12 incoming · 7 at warehouse · Bulk select to move batches"`  
Rationale: warehouse workers scan volume, not personal context. The 4 stage cards serve as their summary.

**Primary action button:** `bg-[#1d4ed8] text-white hover:bg-[#1e40af]` ("Pack", "Move to packing →")

**Bulk action bar (when rows selected):**
```
╭──────────────────────────────────────────────────────╮
│ bg-[#0C447C] text-white rounded-md px-4 py-2.5      │
│  3 selected · Move all to packing?   [Clear] [Move →]│
╰──────────────────────────────────────────────────────╯
```
Navy (not blue) for the bulk bar — navy = authority, the serious action bar deserves a serious color.

**Density:** Table-based, `gap-0` between rows with hairline dividers. Densest layout in the system.

---

### D.3 Fulfiller (`/fulfillment`) — Dual Amber + Blue

**Identity:** "EU dual cycle. Two hats, one screen."  
**Accent:** Tracks the active tab — amber when Sourcing tab active, blue when Warehouse tab active.

**Cycle summary cards (NEW — server component `<FulfillerCycleSummary>`):**
```
╭───────────────────────────────╮  ╭───────────────────────────────╮
│  SOURCING CYCLE               │  │  WAREHOUSE CYCLE              │
│  border-t-2 border-t-amber    │  │  border-t-2 border-t-blue     │
│  .card-surface                │  │  .card-surface                │
│  5 to do  ← text-h2 .mono    │  │  3 to do  ← text-h2 .mono    │
│  ○ In progress: 3             │  │  ○ At warehouse: 2            │
│  ○ Reviewing: 2               │  │  ○ Packing: 1                 │
│  text-label text-ink-tertiary │  │  text-label text-ink-tertiary │
╰───────────────────────────────╯  ╰───────────────────────────────╯
```

**Tabs (color-coded):**
```
[● Sourcing · 5]  [● Warehouse · 3]  [All · 8]  [History]
    amber underline   blue underline
```
- Active sourcing tab: `border-b-2 border-[#b4700a]` + count badge `bg-[#fdf3dd] text-[#633806]`
- Active warehouse tab: `border-b-2 border-[#1d4ed8]` + count badge `bg-[#E6F1FB] text-[#0C447C]`
- Tab context is client-side state (no re-fetch needed — all items already loaded in one query)

**SubOrderRow in fulfiller context:**
- Sourcing-stage items: at-risk → amber left rail `border-l-[#b4700a]`
- Warehouse-stage items: at-risk → blue left rail `border-l-[#378ADD]`
- Density: matches active tab (cards for sourcing, table for warehouse)

**Greeting:** One line beneath the page title — `"5 to source · 3 to warehouse today"`. No full greeting card; the cycle cards serve this purpose.

---

### D.4 Admin (`/dashboard`) — Neutral Navy

**Identity:** "Full visibility. Data authority."  
**Accent:** `--accent` `#0C447C` navy. No role-tinted chrome.

**What changes on admin pages:**
- Token upgrade (PR 1) automatically improves all navy-accented elements
- Consistent `.card-surface` applied to KPI cards, team load cards, invoice cards
- `rise-in` stagger on order table rows and invoice cards
- `.mono` applied to all numeric data (already partial — extend to sub-order IDs in tables)
- Red (`--rose`) stays reserved for alerts only: delayed rows, unassigned count badge, SLA at-risk indicators

**What does NOT change on admin:**
- Dashboard section structure (5 KPIs + 4 team load + filter bar + orders table)
- No new sections, no Control Tower rebuild
- No greeting card — admin sees KPIs immediately

---

## E. Component-by-Component Refresh Plan

| Component | File | Current visual | Proposed change | Impact | Touches logic? |
|---|---|---|---|---|---|
| `<SubOrderRow>` | `app/app/(app)/fulfillment/sub-order-row.tsx` | Flat card, uniform at-risk red border, black primary buttons | Add `role` prop → role-tinted at-risk border, role-colored primary button, `rise-in` stagger class | **High** — used in `/queue`, `/pipeline`, `/fulfillment` | **Careful** — add `role` prop + className changes only. Never touch `useOptimistic`, `startTransition`, `setSubOrderStatusAction`, or `canUploadReceipt` logic |
| `<SourcingGreeting>` | `app/app/(app)/queue/sourcing-greeting.tsx` | Does not exist | New server component: amber top-border card, time-of-day greeting, 3 mini-stats | **High** — top of `/queue` | NO — pure display |
| `<PipelineSummary>` | `app/app/(app)/pipeline/pipeline-summary.tsx` | Does not exist | New server component: 4 stage cards with stage-colored top borders | **High** — top of `/pipeline` | NO — pure display |
| `<FulfillerCycleSummary>` | `app/app/(app)/fulfillment/fulfiller-cycle-summary.tsx` | Does not exist | New server component: 2 cycle cards (amber + blue), count breakdown | **High** — top of `/fulfillment` | NO — pure display |
| `<RoleTabBar>` | `app/app/(app)/fulfillment/role-tab-bar.tsx` | Does not exist | New client component: tabs with role-colored active underline and count badges | **Medium** — used in `/queue`, `/pipeline`, `/fulfillment` | Minimal — tab state only, no server actions |
| `<Sidebar>` | `app/components/nav/sidebar.tsx` | Dark bg (#111418), accent-soft active item | Token upgrade flows automatically. No structural change. | **Low** | NO |
| `<BottomNav>` | `app/components/nav/bottom-nav.tsx` | Mobile nav bar | Token upgrade only | **Low** | NO |
| `<MobileTopbar>` | `app/components/nav/mobile-topbar.tsx` | Mobile header | Token upgrade only | **Low** | NO |
| `<CommandPalette>` | `app/components/nav/command-palette.tsx` | Dark modal, search input | Token upgrade flows automatically | **Low** | NO |
| `<NotificationsPanel>` | `app/components/notifications/notifications-panel.tsx` | Popover, notification list | Token upgrade only | **Low** | NO |
| `<EmptyState>` | `app/components/common/empty-state.tsx` | Icon + title + description | Apply `.card-surface` if not already; keep structure | **Low** | NO |
| Status pills (`.pill`) | `app/globals.css` + `STATUS_PALETTE` in `sub-order-row.tsx` | Colored pill, correct status color | No change — already correct | **None** | NO |
| KPI cards (`/dashboard`) | `app/app/(app)/dashboard/page.tsx` | Inline bg/border/shadow styles | Swap to `.card-surface`. Gross Processed card stays as dark navy variant | **Low** | NO |
| Team load cards (`/dashboard`) | `app/app/(app)/dashboard/page.tsx` | Inline styles | Swap to `.card-surface` + `border-t-2` per team color | **Low** | NO |
| Invoice cards (`/invoices`) | `app/app/(app)/invoices/page.tsx` | Inline card styles | Swap to `.card-surface`, apply `rise-in` stagger | **Low** | NO |
| Order table rows (`/orders`) | `app/app/(app)/orders/page.tsx` | Table rows | Apply `rise-in` stagger, `.mono` on IDs | **Low** | NO |
| Brand cards (`/admin/brands`) | `app/app/(app)/admin/brands/page.tsx` | Inline card styles | Swap to `.card-surface` | **Low** | NO |
| `<SupplierInvoiceDropzone>` | `app/app/(app)/fulfillment/supplier-invoice-dropzone.tsx` | Dropzone inside SubOrderRow | **Do not touch** — carries upload logic, PDF magic-byte validation | **Off-limits** | **YES — do not touch** |
| Login form | `app/app/(auth)/login/login-form.tsx` | Already has BrandSpinnerOverlay | Token upgrade flows automatically. No structural change. | **Low** | NO |
| `app/(auth)/loading.tsx` | `app/app/(auth)/loading.tsx` | BrandSpinner (shipped) | No change needed | **None** | NO |
| `app/(app)/loading.tsx` | `app/app/(app)/loading.tsx` | BrandSpinner (shipped) | No change needed | **None** | NO |
| Auto-assign button | `app/app/(app)/orders/unassigned/auto-assign-button.tsx` | Navy button + inline spinner | Token upgrade flows automatically | **Low** | NO |

---

## F. Page-by-Page Visual Notes

### Auth pages

**`/login`** — Token upgrade only. The dark card on cream background already reads cleanly. BrandSpinnerOverlay on submit is shipped. No structural changes. Only visible delta: navy button shifts from `#2b3aa0` → `#0C447C`.

**`/forgot-password`** — Token upgrade only. Single input + button. No structural changes.

**`/setup/[token]`** — Token upgrade only. Password setup flow with strength indicator. No structural changes. Confirm the "Create account" button inherits the new navy token correctly.

---

### Role views (major changes)

**`/queue` (Sourcing)** — Significant change. New `<SourcingGreeting>` component inserted above the existing group list. Group headers get `text-label uppercase tracking-wide` styling. Each `<SubOrderRow>` receives `role="sourcing"` prop, gaining amber primary buttons and amber at-risk left border. `rise-in` stagger applied to rows. Admin viewing `/queue` also sees the greeting with their admin-scoped data.

**`/pipeline` (Warehouse)** — Significant change. New `<PipelineSummary>` with 4 stage-colored cards inserted at top. The existing item list transitions to compact table density (44px rows, no thumbnails). Each `<SubOrderRow>` receives `role="warehouse"` prop, gaining blue primary buttons. Bulk action bar (when rows selected) gets navy `#0C447C` background. `rise-in` stagger applied to rows.

**`/fulfillment` (Fulfiller)** — Significant change. New `<FulfillerCycleSummary>` with 2 cycle cards inserted at top. Color-coded `<RoleTabBar>` added. Tab switching drives the role prop passed to `<SubOrderRow>` and the density mode (cards vs table). When sourcing tab active: amber accent throughout. When warehouse tab active: blue accent throughout.

---

### Admin pages (token restyle only — no structural changes)

**`/dashboard`** — Token upgrade applies automatically to all navy elements. KPI cards and team load cards get `.card-surface` swap replacing inline styles. Team load cards get `border-t-2` colored by team (sourcing=amber, warehouse=blue, fulfiller=violet, KSA=green). `rise-in` stagger on order table rows. Gross Processed KPI card stays as the dark navy variant — no change to that exception. Delayed orders already have `border-l-2 border-l-status-danger-border` — confirm this still fires correctly after the token upgrade.

**`/orders`** — Token upgrade. `.mono` applied to Order IDs and Sub-order IDs in table. `rise-in` stagger on rows. No structural changes to table columns, sort, or bulk select.

**`/orders/[id]`** — Token upgrade. Status history timeline, sub-order list, customer info card all restyle automatically from token change. No structural change.

**`/orders/unassigned`** — Token upgrade. The red "X waiting" pill and auto-assign button inherit the token update automatically. No structural changes. The brand-mapping bottom panel stays as-is.

**`/invoices`** — Token upgrade. Invoice cards get `.card-surface` swap + `rise-in` stagger. Colored left border by confidence level already implemented — verify it stays correct. The bulk approve navy bar at bottom inherits the token update.

**`/invoices/[id]`** — Token upgrade. Two-column layout unchanged. AI reasoning card, calculation card, customer card, history card all restyle from token. No structural changes.

**`/payroll`** — Token upgrade. Employee table rows get `.mono` on hours, rates, and totals (admin sees all currencies). `rise-in` stagger on rows. No structural changes.

**`/admin/brands`** — Token upgrade. Brand cards get `.card-surface` swap. No structural changes.

**`/admin/invoice-settings`** — Token upgrade. AI model picker, Zoho poll-now button, recent imports list all restyle from token. No structural changes.

**`/admin/team`** — Token upgrade. Invite form, active/deactivate toggles, pending invitations list all restyle from token. No structural changes.

---

## G. Animations and Motion

**Budget: 1–2 purposeful motions per view. No decoration.**

### G.1 Approved animations — wired in Phase 2

| Animation | Class / keyframe | Duration | Trigger | Where used |
|---|---|---|---|---|
| List entrance | `.rise-in` + `--stagger-index` | 420ms + 60ms/item | Page mount | SubOrderRow lists, invoice cards, order table rows, payroll rows |
| Progress bar fill | `.bar-fill` | 720ms | Component mount | Team load bars on dashboard, pipeline stage bars |
| Status dot | `.dot-breathe` | 2.4s, only when count > 0 | Continuous | Unassigned count badge, notification dot |
| KPI number | `.value-tick` | 6s | Continuous | Admin dashboard KPI numbers only |
| Alarm row | `alarmPulse` via `[data-alarm="true"]` | 2.4s | Continuous | Already wired — no change |
| Brand spinner | `brandGlow` on `<BrandSpinner>` | 2s | Loading state | Already shipped — no change |
| Popovers | `popoverIn/Out` | 150/120ms | State change | Notifications, dropdowns — already wired |
| Drawers | `drawerIn/Out` | 280/220ms | State change | Side drawers — already wired |

### G.2 Animations explicitly rejected for Phase 1

| Animation | Why rejected |
|---|---|
| Hover scale/lift (`scale(1.02)`) on cards | This is an 8-hour ops tool. Kinetic hover noise on every card interaction causes fatigue. |
| Page transition animations (route changes) | Next.js route transitions are fast enough. Adding motion here adds latency perception, not delight. |
| Kanban drag-and-drop motion | Drag-and-drop is a future feature, not in scope. |
| Skeleton loading shimmer | `BrandSpinner` is the established loading state. Skeletons alongside it create visual conflict. |
| Sparkline animations on KPI cards | The `sparkWave` keyframe exists but applying it to dashboard KPI sparklines is distracting over an 8-hour shift. Omit until explicitly requested. |
| Any Lottie or SVG path animation | No new animation dependencies in Phase 1. |
| `ribbonScan` (gradient sweep) | Decorative. No functional meaning in an ops context. |

### G.3 Motion rules

1. **No new keyframes.** The existing set in `globals.css` is complete for Phase 1.
2. **`rise-in` on page mount only.** Do not re-apply on filter tab changes — stagger is for initial render, not interaction.
3. **`dot-breathe` conditionally.** Apply as `className={count > 0 ? "dot-breathe" : ""}`. A zero-count badge should not pulse.
4. **`prefers-reduced-motion` is already handled.** The `@media (prefers-reduced-motion: reduce)` block in `globals.css` covers `.rise-in`, `.value-tick`, `.bar-fill`, and `.dot-breathe`. Do not override it.
5. **Optimistic status updates are instant.** `useTransition` pending state is the only feedback. No animation on the status pill change.

---

## H. Risks and "Do Not Touch" List

### H.1 Components that carry logic — modification rules

**`app/app/(app)/fulfillment/sub-order-row.tsx`**  
This is the highest-impact file in the refresh. It carries: `useOptimistic` for instant status feedback, `useTransition` for concurrent updates, `setSubOrderStatusAction` server action call, `getNextStatuses()` role whitelist filtering, `SupplierInvoiceDropzone` with PDF upload logic, and the mapping panel toggle.

**Rule:** In Phase 2, I will only modify:
- The outer container's `className` string (add `rise-in`, adjust border-left logic)
- The `buttonVariantFor()` return value based on the new `role` prop
- The `VARIANT_CLASS()` mapping for the `"primary"` variant to accept role color

I will never modify: the `advance()` function, `useOptimistic` state, `useTransition`, the `nextStatuses` filtering logic, `canUploadReceipt` branching, or `SupplierInvoiceDropzone`. Any change that goes beyond className strings requires a separate PR with explicit review.

**`app/app/(app)/fulfillment/supplier-invoice-dropzone.tsx`**  
Carries PDF magic-byte validation, Supabase storage upload, ownership check. **Off-limits in Phase 1.** Visual appearance of the dropzone (border color, hover state) is acceptable to adjust via className only — no logic changes.

**`app/app/(app)/fulfillment/actions.ts`**  
Server actions: `setSubOrderStatusAction`, `uploadSupplierInvoiceAction`. **Off-limits entirely.** Phase 1 never touches server action files.

**`app/lib/workflow/sub-order-transitions.ts`**  
Status machine + `getNextStatuses()`. **Off-limits entirely.** The status whitelist per role is correct and must not be touched.

**`app/lib/constants.ts`**  
`ROLE_STATUS_WHITELIST`. **Off-limits entirely.**

### H.2 How SubOrderRow gets role-specific accent without forking

The `role` prop strategy:

```tsx
// In sub-order-row.tsx — the only change to the component signature:
export function SubOrderRow({
  row,
  nextStatuses,
  canUploadReceipt = false,
  role = "admin",  // NEW prop — defaults to admin (neutral) if not passed
}: {
  row: FulfillmentRow;
  nextStatuses: StatusCode[];
  canUploadReceipt?: boolean;
  role?: "sourcing" | "warehouse" | "fulfiller" | "admin";  // NEW
})
```

The `role` prop drives two things only:
1. At-risk border color: `is_at_risk && !is_delayed` → `border-l-[#b4700a]` (sourcing) / `border-l-[#378ADD]` (warehouse) / `border-l-[#6d28d9]` (fulfiller) / `border-l-status-danger-border` (admin)
2. Primary button variant: first action button gets role-accented background

No forking. No context provider needed. One prop, one file.

### H.3 Pricing isolation — Phase 1 never touches this

The three new display components (`<SourcingGreeting>`, `<PipelineSummary>`, `<FulfillerCycleSummary>`) show only counts. No prices. No `unit_price`, `subtotal`, `cost`, or any financial field appears anywhere in these components.

The `<SubOrderRow>` role prop does not expose any pricing information. The price columns remain gated by the admin-only service-role client path, untouched by this refresh.

### H.4 Regression risks and mitigations

| Risk | Where | Mitigation |
|---|---|---|
| Token upgrade breaks a hardcoded `#2b3aa0` reference | Any component with inline navy hex | Grep for `2b3aa0` before PR 1 merges; fix all occurrences |
| `rise-in` applied to non-list elements causes flicker | Any component receiving the class | Apply only to direct children of list containers, not to cards that contain lists |
| Warehouse compact table overflows on mobile | `/pipeline` | Wrap table in `overflow-x-auto` div |
| Fulfiller tab accent doesn't update `SubOrderRow` border | `/fulfillment` | Tab state must be a client component that passes the current role down to the list |
| `.card-surface` swap changes card dimensions (e.g., different border-width) | All admin pages | `.card-surface` uses `border: 0.5px solid var(--line)` — same as most existing inline styles. Verify visually on each swapped card |
| `jwt_is_admin()` — no new `is_admin()` calls | All new components | All new components receive data as props from parent server pages that already handle auth. No new RLS queries in display components |

---

## I. Phasing — Phase 2 PR Breakdown

Each PR must be deployable on its own without visual brokenness.

### PR 1 — Token upgrade (~15 min, very low risk)
**Files:** `tailwind.config.ts`, `app/globals.css`  
**Change:** Navy token `#2b3aa0` → `#0C447C`. RGB triplet update. New role accent CSS vars.  
**Verify:** `npm run typecheck && npm run build` — zero errors. Visually: navy buttons/links/focus rings shift to deeper navy. Everything else unchanged.

---

### PR 2 — `SubOrderRow` role prop (~1h, medium risk)
**Files:** `app/app/(app)/fulfillment/sub-order-row.tsx` + 3 caller pages  
**Change:** Add `role` prop. Role-tinted at-risk border. Role-colored primary button. `rise-in` stagger.  
**Callers:** `/queue/page.tsx` → `role="sourcing"`, `/pipeline/page.tsx` → `role="warehouse"`, `/fulfillment/page.tsx` → `role="fulfiller"`  
**Verify:** All 3 role views render. Delayed rows still show red border. TypeScript zero errors.

---

### PR 3 — Sourcing greeting card (~2h, low risk)
**Files:** `app/app/(app)/queue/page.tsx` + new `sourcing-greeting.tsx`  
**Change:** Build `<SourcingGreeting>`. Insert above group list. Wire `rise-in` stagger to group rows.  
**Verify:** Sourcing-test sees greeting with correct name + counts. Admin viewing `/queue` sees greeting.

---

### PR 4 — Warehouse pipeline summary (~2h, low risk)
**Files:** `app/app/(app)/pipeline/page.tsx` + new `pipeline-summary.tsx`  
**Change:** Build `<PipelineSummary>`. Compact table density (44px rows, no thumbnails). Bulk action nav bar.  
**Verify:** Warehouse-test sees 4 stage cards. Stage counts use `.mono`. Bulk select bar appears when rows checked.

---

### PR 5 — Fulfiller cycle summary (~2h, low risk)
**Files:** `app/app/(app)/fulfillment/page.tsx` + new `fulfiller-cycle-summary.tsx` + new `role-tab-bar.tsx`  
**Change:** Build `<FulfillerCycleSummary>`. Color-coded `<RoleTabBar>`. Tab state drives `role` prop on `<SubOrderRow>`.  
**Verify:** Fulfiller-test sees both cycle cards. Tab switches change accent color. Sourcing-stage items get amber rail, warehouse-stage items get blue rail.

---

### PR 6 — Admin `.card-surface` audit + `rise-in` (~1.5h, low risk)
**Files:** `/dashboard`, `/orders`, `/invoices`, `/payroll`, `/admin/*` page components  
**Change:** Swap inline card styles → `.card-surface`. Apply `.mono` to all numeric data. Apply `rise-in` stagger to table rows and invoice cards.  
**Verify:** Visual regression on all admin pages. No layout shifts. `npm run build` clean.

---

### PR 7 — Auth pages + miscellaneous cleanup (~30 min, very low risk)
**Files:** `/login`, `/forgot-password`, `/setup/[token]`, any remaining token-upgrade stragglers  
**Change:** Verify token upgrade flows correctly to all auth page elements. Fix any hardcoded `#2b3aa0` references found in grep.  
**Verify:** Login page visual check. `npm run typecheck` clean.

---

### PR 8 — Mobile QA + Lighthouse (~30 min)
**Files:** `/pipeline/page.tsx` (overflow-x-auto), any 44px touch target fixes found during testing  
**Change:** Warehouse table mobile scroll wrapper. Touch target audit on new role cards and tabs.  
**Verify:** 375px test on `/queue`, `/pipeline`, `/fulfillment`. Lighthouse Accessibility ≥ 90 on `/dashboard`, `/queue`, `/invoices`.

---

**Total estimate: 3–4 days. Zero new dependencies. Zero schema changes. Zero new routes.**

---

## J. Open Questions

| # | Question | Why I can't answer it | Blocks |
|---|---|---|---|
| J1 | **Design direction: C approved?** The proposal recommends Direction C (keep cream bg, upgrade navy to `#0C447C`). Is this the call, or do you want to go full Direction B (cool grey `#F5F5F7`)? | Your call — both are defensible. Direction B requires ~30 more component edits. | PR 1 |
| J2 | **Sourcing greeting for admin on `/queue`:** When an admin visits `/queue`, should they see the greeting card ("Good morning, Admin — viewing all 42 items across 6 brands")? Or does admin skip the greeting and go straight to the list? | UX preference — admin context is different from the sourcing employee's personal list. | PR 3 |
| J3 | **Fulfiller dual accent: single purple or split amber/blue?** The proposal uses amber/blue split (tracks active tab). An alternative is a fixed purple `#6d28d9` throughout (simpler, no tab-driven color switching). Which feels right for a dual-role operator? | UX preference — split is more expressive but adds client state complexity. | PR 5 |
| J4 | **Warehouse greeting: none, or a mini one-liner?** Proposal gives warehouse a one-line subtitle instead of a full greeting card (rationale: volume workers scan numbers, not personal context). Is that right, or does the warehouse role also deserve a greeting card matching sourcing's format? | Operational context — depends on how your warehouse operator actually uses the screen. | PR 4 |
| J5 | **Test accounts:** Are `sourcing-test`, `warehouse-test`, and `fulfiller-test` (password `Trendlet!Test2026`) still live in production Supabase for QA? Or have they been deleted ahead of launch? | Need to verify before Phase 2 QA begins. | All PRs |

---

## K. Acceptance Criteria for Phase 2

A checklist to verify after Phase 2 ships. Every item must pass before marking Phase 1 done.

**Role identity**
- [ ] When `sourcing-test` logs in, they see a greeting card reading "Good [time of day], [first name]" with item count and brand count, in amber-accented chrome
- [ ] When `warehouse-test` logs in, they see 4 stage-summary cards in blue-accented chrome, then the compact table
- [ ] When `fulfiller-test` logs in, they see 2 cycle cards (amber sourcing / blue warehouse) with a color-coded tab bar
- [ ] When admin logs in, they see the same dashboard sections as today (5 KPIs, 4 team load cards, filter bar, orders table) with no structural additions
- [ ] Walking past any monitor, you can identify which role is logged in from the accent color alone

**Token contract**
- [ ] No hex value outside the approved token contract appears in any new component (grep for raw hex in new files)
- [ ] No `font-semibold` or `font-bold` class appears in any new or modified file
- [ ] No new font family beyond Inter and JetBrains Mono is introduced

**Numeric data**
- [ ] All order IDs, sub-order IDs, quantities, SLA timers, and prices (admin only) render in JetBrains Mono with `tabular-nums`
- [ ] KPI numbers on the dashboard use `.mono` and `.value-tick`

**SubOrderRow integrity**
- [ ] Dropzone (`SupplierInvoiceDropzone`) works correctly in `/queue` for sourcing role
- [ ] Mapping panel toggles correctly in `/queue` after receipt upload
- [ ] Status buttons are filtered by role whitelist (sourcing cannot click warehouse buttons)
- [ ] Optimistic updates fire and revert correctly on error
- [ ] Delayed rows show danger red left border regardless of role
- [ ] At-risk (not delayed) rows show role-tinted left border (amber/blue/violet per role)

**Pricing isolation**
- [ ] No prices visible to sourcing-test anywhere — verify in DOM inspector, not just visual
- [ ] No prices visible to warehouse-test anywhere
- [ ] No prices visible to fulfiller-test anywhere
- [ ] Admin sees prices correctly on `/invoices` and `/orders/[id]`

**Security**
- [ ] No `is_admin()` call in any new or modified file — only `jwt_is_admin()`
- [ ] New greeting/summary components receive data as props from their parent server page — no direct Supabase calls inside display components

**Build quality**
- [ ] `npm run typecheck` passes with zero new errors after each PR
- [ ] `npm run build` passes with zero new warnings after each PR
- [ ] No console errors on any role view in production

**Mobile**
- [ ] `/queue` greeting card collapses gracefully at 375px (mini-stats stack vertically)
- [ ] `/pipeline` warehouse table has horizontal scroll on mobile — no content clipping
- [ ] `/fulfillment` cycle cards stack vertically at 375px
- [ ] All new interactive elements (tab bar items, greeting mini-stat cards) meet 44×44px touch target minimum

**Accessibility**
- [ ] Lighthouse Accessibility score ≥ 90 on `/dashboard`, `/queue`, `/pipeline`, `/fulfillment`, `/invoices`
- [ ] Tab bar uses `role="tablist"` + `role="tab"` + `aria-selected`
- [ ] Greeting card uses `aria-label="[Role] summary"`
- [ ] Color is never the only differentiator — role accent is always paired with text labels

**Animation**
- [ ] `prefers-reduced-motion` suppresses `rise-in`, `value-tick`, `bar-fill`, and `dot-breathe` — tested in browser
- [ ] No continuously running animation except: `alarmPulse` on `[data-alarm="true"]` rows, `brandGlow` on `<BrandSpinner>`, `dot-breathe` when count > 0, `value-tick` on KPI numbers
- [ ] No hover scale, lift, or shimmer effects on any card

---

## Appendix — Current State Audit

*(Moved from the original Section B for reference)*

### What's working well

| Area | Assessment |
|---|---|
| Type scale | h1/h2/body/label/hint correctly implemented at spec values |
| Font weights | 400 + 500 only — spec-compliant throughout |
| Status pills | `.pill` class + `STATUS_PALETTE` record is clean and consistent |
| JetBrains Mono | `.mono` class used correctly for numeric data |
| Animation primitives | `riseIn`, `barFill`, `dotBreathe`, `brandGlow`, `alarmPulse` are all in globals.css |
| Sidebar | Dark (#111418) against cream page — strong visual contrast |
| BrandSpinner | `components/spinner/brand-spinner.tsx` with `brand-spinner-glow` — shipped and polished |

### Gaps (all addressed by the PRs above)

1. No per-role visual identity — all 3 role views render identical chrome
2. Direction tension — spec navy `#0C447C` vs implemented `#2b3aa0` (resolved by Direction C)
3. `SubOrderRow` visually flat — no role-adaptive color
4. Greeting card (`/queue`) not yet built
5. Pipeline summary cards (`/pipeline`) not yet built
6. Fulfiller cycle summary (`/fulfillment`) not yet built
7. `.card-surface` class inconsistently applied across admin pages
8. `rise-in` stagger exists but not wired to any list

### Files that must NOT be touched in Phase 2

- `supabase/migrations/` — no schema changes
- `lib/integrations/` — no API integration changes
- `lib/workflow/sub-order-transitions.ts` — status machine is correct
- `lib/constants.ts` — `ROLE_STATUS_WHITELIST` stays unchanged
- `app/app/(app)/fulfillment/actions.ts` — server actions stay unchanged
- `vercel.json` — cron jobs stay unchanged
- `supplier-invoice-dropzone.tsx` logic — className-only changes permitted
- Any `customer_invoices` flow pages
- Git author — stays `ai@trendlet.com`

---

*End of proposal. Awaiting answers to §J (open questions) and §C direction approval before Phase 2 begins.*
