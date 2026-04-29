/**
 * Phase 4f: extract structured line items from a supplier-receipt PDF
 * via OpenRouter. Mock-fallback by default — set OPENROUTER_API_KEY
 * to flip to live mode.
 *
 * Flow when configured:
 *   1. Caller passes the PDF buffer + the model_id chosen in
 *      settings.ocr_model_id (e.g. 'openai/gpt-4o').
 *   2. We base64-encode the PDF and POST to OpenRouter's chat
 *      completions endpoint with a structured-output prompt.
 *   3. Parse the JSON response into ExtractedInvoice.
 *
 * Mock mode returns a tiny realistic-looking payload so the UI flow
 * (extract → map → create drafts) can be exercised end-to-end without
 * paying for AI calls. Switch to live by:
 *   - setting OPENROUTER_API_KEY in .env.local + Vercel
 *   - making sure settings.ocr_model_id resolves to a model_id known
 *     to OpenRouter (e.g. 'openai/gpt-4o' or 'anthropic/claude-haiku-4-5')
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export type ExtractedItem = {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  ai_confidence: "high" | "medium" | "low";
  ai_match_score: number; // 0..1
  ai_reasoning: string;
};

export type ExtractedInvoice = {
  supplier_name: string | null;
  invoice_date: string | null; // ISO date
  invoice_total: number | null;
  currency: string | null; // ISO 4217 (USD/EUR/SAR/...)
  barcode: string | null;
  items: ExtractedItem[];
};

export type ExtractMode = "live" | "mock";

export type ExtractResult = {
  mode: ExtractMode;
  model_used: string;
  data: ExtractedInvoice;
  error: string | null;
};

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function extractSupplierInvoice(input: {
  pdf: Buffer;
  modelId: string;
  filename: string;
}): Promise<ExtractResult> {
  if (!isOpenRouterConfigured()) {
    return mockExtract(input);
  }

  const apiKey = process.env.OPENROUTER_API_KEY!;
  const base64 = input.pdf.toString("base64");
  const dataUrl = `data:application/pdf;base64,${base64}`;

  const body = {
    model: input.modelId,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You extract structured line-item data from supplier receipts. " +
          "Return STRICT JSON matching this TypeScript shape: " +
          "{ supplier_name: string|null, invoice_date: string|null (ISO YYYY-MM-DD), " +
          "invoice_total: number|null, currency: string|null (ISO 4217), " +
          "barcode: string|null, items: { description: string, quantity: number, " +
          "unit_price: number, line_total: number, ai_confidence: 'high'|'medium'|'low', " +
          "ai_match_score: number (0..1), ai_reasoning: string }[] }. " +
          "Use null for any field you can't confidently read. Never invent values. " +
          "BARCODE GUIDANCE: Every receipt usually prints ONE barcode at the bottom " +
          "representing the whole transaction. Read the human-readable digits printed " +
          "directly under the barcode bars (typically Code-128: 8-20 digits or " +
          "alphanumerics, or EAN-13: exactly 13 digits). If you can't see the digits " +
          "clearly, return null — do NOT guess from the bars alone. " +
          "If the receipt has multiple barcodes, return the one closest to the total " +
          "amount (the transaction barcode), not per-item product barcodes.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: `Extract data from receipt: ${input.filename}` },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://trendlet.vercel.app",
        "X-Title": "Trendlet OMS",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        mode: "live",
        model_used: input.modelId,
        data: emptyExtraction(),
        error: `OpenRouter ${res.status}: ${text.slice(0, 300)}`,
      };
    }

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    const parsed = safeParseJson(content);
    if (!parsed) {
      return {
        mode: "live",
        model_used: input.modelId,
        data: emptyExtraction(),
        error: "Model returned non-JSON content.",
      };
    }
    return {
      mode: "live",
      model_used: input.modelId,
      data: normalize(parsed),
      error: null,
    };
  } catch (e) {
    return {
      mode: "live",
      model_used: input.modelId,
      data: emptyExtraction(),
      error: e instanceof Error ? e.message : "Unknown extraction failure.",
    };
  }
}

function mockExtract(input: { filename: string; modelId: string }): ExtractResult {
  // Pick deterministic fake items based on filename so retries are stable.
  const hash = hashCode(input.filename);
  const items: ExtractedItem[] =
    hash % 3 === 0
      ? [
          mockItem("Santal 33 Eau de Parfum 50ml", 1, 180.0),
          mockItem("Rose 31 Eau de Parfum 100ml", 1, 245.0),
        ]
      : hash % 3 === 1
      ? [mockItem("Discovery Set — 5x 1.5ml", 1, 90.0)]
      : [
          mockItem("Bergamote 22 EDP 100ml", 1, 230.0),
          mockItem("Santal 33 Body Lotion 250ml", 2, 65.0),
        ];

  const subtotal = items.reduce((sum, i) => sum + i.line_total, 0);
  return {
    mode: "mock",
    model_used: input.modelId,
    data: {
      supplier_name: "Le Labo (mock)",
      invoice_date: new Date().toISOString().slice(0, 10),
      invoice_total: Number(subtotal.toFixed(2)),
      currency: "USD",
      barcode: mockBarcode(hash),
      items,
    },
    error: null,
  };
}

/**
 * Generate a plausible mock barcode. Even-hash → EAN-13 (13 digits),
 * odd-hash → Code-128 alphanumeric. Both pass validateBarcode().
 */
function mockBarcode(hash: number): string {
  if (hash % 2 === 0) {
    // EAN-13: pad hash to 13 digits.
    return String(hash).padStart(13, "0").slice(0, 13);
  }
  // Code-128 alphanumeric, 12 chars.
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let out = "";
  let h = hash;
  for (let i = 0; i < 12; i++) {
    out += i % 3 === 0 ? alpha[h % alpha.length] : String(h % 10);
    h = Math.floor(h / 7) + 1;
  }
  return out;
}

function mockItem(description: string, qty: number, unit: number): ExtractedItem {
  return {
    description,
    quantity: qty,
    unit_price: unit,
    line_total: Number((qty * unit).toFixed(2)),
    ai_confidence: "high",
    ai_match_score: 0.95,
    ai_reasoning: "Mock extraction — set OPENROUTER_API_KEY to use real AI.",
  };
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Some models return ```json ... ``` fences; strip them.
    const stripped = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
    try {
      return JSON.parse(stripped);
    } catch {
      return null;
    }
  }
}

function emptyExtraction(): ExtractedInvoice {
  return {
    supplier_name: null,
    invoice_date: null,
    invoice_total: null,
    currency: null,
    barcode: null,
    items: [],
  };
}

function normalize(raw: unknown): ExtractedInvoice {
  const r = raw as Partial<ExtractedInvoice> & { items?: unknown[] };
  const items = Array.isArray(r.items)
    ? r.items
        .map((it) => normalizeItem(it))
        .filter((it): it is ExtractedItem => it !== null)
    : [];
  return {
    supplier_name: typeof r.supplier_name === "string" ? r.supplier_name : null,
    invoice_date: typeof r.invoice_date === "string" ? r.invoice_date : null,
    invoice_total: typeof r.invoice_total === "number" ? r.invoice_total : null,
    currency: typeof r.currency === "string" ? r.currency : null,
    barcode: validateBarcode(typeof r.barcode === "string" ? r.barcode : null),
    items,
  };
}

/**
 * Phase 6: format-heuristic check on AI-read barcodes. Vision models can
 * misread bars and emit a plausible-looking but wrong number. We reject
 * anything that doesn't match common retail formats (EAN-13, EAN-8,
 * UPC-A, or Code-128 alphanumeric of reasonable length). Length<6 or
 * length>30 is rejected outright.
 */
function validateBarcode(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\s+/g, "");
  if (trimmed.length < 6 || trimmed.length > 30) return null;
  // Allow only digits, uppercase letters, hyphens — typical receipt barcodes.
  if (!/^[A-Z0-9-]+$/i.test(trimmed)) return null;
  // Reject obvious mock/placeholder strings the model might hallucinate.
  if (/^0+$/.test(trimmed) || /^1+$/.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

function normalizeItem(raw: unknown): ExtractedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const description = typeof r.description === "string" ? r.description : "";
  const quantity = typeof r.quantity === "number" ? r.quantity : 1;
  const unit_price = typeof r.unit_price === "number" ? r.unit_price : 0;
  const line_total =
    typeof r.line_total === "number" ? r.line_total : quantity * unit_price;
  if (!description) return null;
  const conf = r.ai_confidence;
  const ai_confidence: ExtractedItem["ai_confidence"] =
    conf === "high" || conf === "medium" || conf === "low" ? conf : "medium";
  return {
    description,
    quantity,
    unit_price,
    line_total,
    ai_confidence,
    ai_match_score: typeof r.ai_match_score === "number" ? r.ai_match_score : 0.5,
    ai_reasoning: typeof r.ai_reasoning === "string" ? r.ai_reasoning : "",
  };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
