# Trendlet Support AI — Read-Only Data API (Core v1)

Secure, read-only HTTP layer over live Trendlet operational data, for the
future AI Support app. The AI calls these endpoints — it never touches
Supabase and never writes SQL.

**Scope of this release (core, incremental):**
`getOrderDetails`, `searchOrdersByEmail`, `getShipmentTracking`.
Later: customer-name search, sub-order history, escalation, analytics,
caching.

---

## 1. Endpoints

Base URL = the deployed Trendlet app origin (same Vercel deployment).

| Operation | Method & Path |
|---|---|
| `getOrderDetails` | `GET /api/support/orders/{orderNumber}` |
| `searchOrdersByEmail` | `GET /api/support/search/email?q={email}` |
| `getShipmentTracking` | `GET /api/support/orders/{orderNumber}/tracking` |

All are `GET`, read-only, dynamic (never cached server-side — always live).

---

## 2. Auth / security model

- **Static internal Bearer token.** Every request MUST send:
  `Authorization: Bearer <INTERNAL_AI_TOKEN>`
- The token is validated server-side with a constant-time compare.
  Missing/invalid → `401 UNAUTHORIZED`. Fails closed if the server token
  is unset.
- The API is the **only** trust boundary. It talks to Supabase with the
  **service-role key server-side only** — that key is never exposed and
  the AI never connects to Supabase directly.
- **Read-only:** every handler runs `SELECT` only. No INSERT/UPDATE/
  DELETE/DDL anywhere in this layer.
- **Never exposed in responses:** internal UUIDs, employee names,
  `status_changed_by`/`assigned_employee`, admin notes / `status_history.
  metadata`, internal shipment IDs, raw schema, tokens. Responses are
  hand-normalized DTOs (a stray DB column cannot leak — only mapped
  fields are returned).
- **Input validation:** every path/query param is zod-validated
  (format + length) before any DB call. All customer-supplied text is
  treated as untrusted data (parameterized queries, no string SQL).
- **Result limits:** email search is hard-capped at 20 orders.

---

## 3. Request / response formats

### 3.1 `getOrderDetails` — `GET /api/support/orders/{orderNumber}`
`{orderNumber}` = the customer-facing Shopify order number (a leading
`#` is tolerated). Returns the order + **all** sub-orders (each its own
status + tracking).

**200 success:**
```json
{
  "found": true,
  "orderNumber": "1209",
  "financialStatus": "paid",
  "customer": { "name": "John Doe", "email": "john@example.com" },
  "subOrders": [
    {
      "subOrderNumber": "1209-01",
      "productTitle": "REMY SHOULDER BAG",
      "quantity": 1,
      "status": { "key": "shipped", "label_en": "Shipped", "label_ar": "تم الشحن", "isTerminal": false },
      "statusChangedAt": "2026-05-18T10:00:00.000Z",
      "tracking": {
        "trackingNumber": "AR123",
        "shipmentStatus": "in_transit",
        "shippedAt": "2026-05-18T09:00:00.000Z",
        "deliveredAt": null
      }
    }
  ],
  "summary": { "subOrderCount": 2, "mixedStatuses": true }
}
```
- `tracking` is `null` when no shipment is linked to that sub-order.
- `customer` is `null` if the order has no linked customer.
- `summary.mixedStatuses` = true when sub-orders are not all the same
  status (the AI should explicitly tell the customer item-by-item).

### 3.2 `searchOrdersByEmail` — `GET /api/support/search/email?q={email}`
Case-insensitive email match. Returns capped **summaries** (not full
detail — the AI then calls `getOrderDetails` for a chosen order).

**200 success:**
```json
{
  "found": true,
  "query": "email",
  "resultCount": 2,
  "results": [
    {
      "orderNumber": "1209",
      "placedAt": "2026-05-18T12:00:00.000Z",
      "subOrderCount": 2,
      "statusSummary": "1 Shipped, 1 Cancelled"
    }
  ]
}
```

### 3.3 `getShipmentTracking` — `GET /api/support/orders/{orderNumber}/tracking`
Tracking grouped by shipment (one shipment can cover several sub-orders).

**200 success:**
```json
{
  "found": true,
  "orderNumber": "1209",
  "shipments": [
    {
      "subOrderNumbers": ["1209-01", "1209-02"],
      "trackingNumber": "AR123",
      "shipmentStatus": "in_transit",
      "shippedAt": "2026-05-18T09:00:00.000Z",
      "deliveredAt": null
    }
  ]
}
```
`shipments: []` means the order has no shipments yet.

---

## 4. Error response structure (uniform)

```json
{ "found": false, "error": { "code": "ORDER_NOT_FOUND", "message": "..." } }
```

| code | HTTP | When | AI should…|
|---|---|---|---|
| `UNAUTHORIZED` | 401 | Missing/invalid Bearer token | not retry; this is a config/integration error |
| `INVALID_INPUT` | 400 | Bad order-number/email format | ask the customer for a valid value |
| `ORDER_NOT_FOUND` | 200 | No match | ask the customer to re-check the order number or give the checkout email |
| `AMBIGUOUS_MATCH` | 200 | (future: name search) too many matches | ask a clarifying question |
| `RATE_LIMITED` | 429 | (reserved) | back off and retry later |
| `UPSTREAM_ERROR` | 502 | DB/unexpected failure | apologise, suggest trying again shortly; do NOT invent data |

Note: "not found" returns **HTTP 200** with `found:false` so the AI
handles it conversationally rather than as a transport error.

---

## 5. Environment variables

| Var | Where | Purpose |
|---|---|---|
| `INTERNAL_AI_TOKEN` | Trendlet (Vercel) **and** the Support AI app | Shared static Bearer secret. Rotate by updating both. |
| `NEXT_PUBLIC_SUPABASE_URL` | Trendlet (existing) | Supabase project URL (server use). |
| `SUPABASE_SERVICE_ROLE_KEY` | Trendlet (existing) | Server-only Supabase access behind the API. Never given to the AI. |

The Support AI app needs only: `INTERNAL_AI_TOKEN` + the Trendlet base URL.

> ⚠️ Set `INTERNAL_AI_TOKEN` in Vercel for **Production *and* Preview**
> (Trendlet preview deploys 500 without correctly-scoped env — known
> project quirk). Generate a long random secret (e.g. `openssl rand -hex 32`).

---

## 6. Example integrations

### 6.1 Raw fetch (any language)
```bash
curl -s "https://<trendlet-app>/api/support/orders/1209" \
  -H "Authorization: Bearer $INTERNAL_AI_TOKEN"
```

### 6.2 Node / TS client used by the Support AI app
```ts
const BASE = process.env.TRENDLET_API_BASE!;
const TOKEN = process.env.INTERNAL_AI_TOKEN!;

async function getOrderDetails(orderNumber: string) {
  const r = await fetch(
    `${BASE}/api/support/orders/${encodeURIComponent(orderNumber)}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } },
  );
  return r.json(); // { found:true, ... } | { found:false, error:{...} }
}
```

### 6.3 As an AI tool definition (no SQL — fixed tools only)
```json
[
  {
    "name": "getOrderDetails",
    "description": "Look up an order's fulfillment status + items by order number.",
    "input_schema": { "type": "object",
      "properties": { "orderNumber": { "type": "string" } },
      "required": ["orderNumber"] }
  },
  {
    "name": "searchOrdersByEmail",
    "description": "Find a customer's recent orders by their checkout email.",
    "input_schema": { "type": "object",
      "properties": { "email": { "type": "string" } }, "required": ["email"] }
  },
  {
    "name": "getShipmentTracking",
    "description": "Get shipment tracking for an order by order number.",
    "input_schema": { "type": "object",
      "properties": { "orderNumber": { "type": "string" } },
      "required": ["orderNumber"] }
  }
]
```
Each tool maps 1:1 to the HTTP endpoint above. The AI has **no** SQL/DB
tool — it can only call these fixed operations.

---

## 7. How the Support AI should use this

1. Extract an **order number** or **email** from the customer message.
2. Order number → `getOrderDetails` (and `getShipmentTracking` if they
   ask "where is my package"). Email only → `searchOrdersByEmail`, then
   `getOrderDetails` on the chosen order.
3. Reply using **`label_ar`** if the customer wrote Arabic, else
   `label_en`. List **every** sub-order; if `mixedStatuses` is true,
   state it explicitly (e.g. "Item 1: Shipped · Item 2: Cancelled").
4. Use `statusChangedAt` for "as of <date>". Never show raw status keys,
   IDs, or employee info. Never invent missing fulfillment/tracking data
   — if a field is null, say it's not available yet.
5. On `ORDER_NOT_FOUND`, ask for the order number or checkout email.

---

## 8. Logging & observability

Every call is logged to `api_logs` (`service = "support_ai"`): endpoint,
method, success/error, http_status, latency_ms, error_message — **metadata
only**, no request bodies, no PII, no tokens. Auth failures are logged
too. Query `api_logs WHERE service='support_ai'` for usage/latency.

**Rate limiting:** not enforced in core v1 (Vercel serverless has no
shared store; this is a single trusted internal consumer). Volume is
observable via `api_logs`; add a store-backed limiter (e.g. Upstash) only
if abuse appears. `RATE_LIMITED` code is reserved for that future step.

---

## 9. KB + realtime orders orchestration (recommended)

Keep them separate and complementary in the Support AI:

- **This realtime API = the only source for order-specific facts**
  (status, tracking, "where is my order"). Always live; never cache;
  never copy into a knowledge base.
- **Knowledge base** = static policy content (returns, shipping times,
  FAQs).
- **Routing rule:** classify intent first. Order-specific → call this
  API. Policy/general → KB. Mixed (e.g. "can I return order 1209?") →
  call this API for the order's live state **and** KB for the policy,
  then compose. Never answer an order-status question from the KB; never
  push order data into the KB.

This preserves data freshness and avoids the embedding/sync pitfalls
that are explicitly out of scope.
