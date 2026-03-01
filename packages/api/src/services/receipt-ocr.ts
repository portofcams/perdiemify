/**
 * Receipt OCR Service — Phase 5
 *
 * Primary: Claude Vision API (claude-haiku-4-5-20251001) for structured receipt extraction.
 * Fallback: Tesseract.js OCR when ANTHROPIC_API_KEY is not set.
 */

import Tesseract from 'tesseract.js';

// ─── Types ───────────────────────────────────────────────────────

export interface OcrResult {
  rawText: string;
  vendor: string | null;
  amount: number | null;
  date: string | null; // YYYY-MM-DD
  category: string | null;
  confidence: number; // 0-100
  lineItems: LineItem[];
  engine: 'claude' | 'tesseract';
}

export interface LineItem {
  description: string;
  amount: number;
  quantity?: number;
}

// ─── Claude Vision OCR ──────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a receipt data extraction system. Analyze this receipt image and extract structured data.

Return ONLY valid JSON (no markdown, no explanation) with this exact schema:
{
  "vendor": "string or null — the business/store name",
  "amount": number or null — the total amount charged (look for Grand Total, Total Due, Amount, etc.),
  "date": "YYYY-MM-DD string or null — the transaction date",
  "category": "lodging" | "meals" | "transport" | "parking" | "tips" | "other",
  "confidence": number 0-100 — your confidence in the extraction accuracy,
  "lineItems": [{ "description": "item name", "amount": 12.99, "quantity": 1 }],
  "rawText": "full text content of the receipt"
}

Category rules:
- lodging: hotels, motels, resorts, airbnb, inn, suites
- meals: restaurants, cafes, fast food, coffee shops, any food/beverage
- transport: uber, lyft, taxi, rental car, gas station, airline, train
- parking: parking garage, valet, meter, lot
- tips: gratuity
- other: anything else

Be precise with amounts — use the final total, not subtotals.`;

export async function processReceiptWithClaude(imageBuffer: Buffer): Promise<OcrResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  // Detect MIME type from buffer magic bytes
  const mime = detectMimeType(imageBuffer);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mime,
                data: imageBuffer.toString('base64'),
              },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errBody}`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text?: string }>;
  };

  const textBlock = data.content.find((b) => b.type === 'text');
  if (!textBlock?.text) throw new Error('No text response from Claude');

  // Parse JSON from response (handle potential markdown wrapping)
  let jsonStr = textBlock.text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(jsonStr) as {
    vendor: string | null;
    amount: number | null;
    date: string | null;
    category: string | null;
    confidence: number;
    lineItems: LineItem[];
    rawText: string;
  };

  return {
    rawText: parsed.rawText || '',
    vendor: parsed.vendor,
    amount: parsed.amount != null ? Math.round(parsed.amount * 100) / 100 : null,
    date: parsed.date,
    category: parsed.category,
    confidence: parsed.confidence || 90,
    lineItems: parsed.lineItems || [],
    engine: 'claude',
  };
}

function detectMimeType(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49) return 'image/gif';
  if (buf[0] === 0x52 && buf[1] === 0x49) return 'image/webp';
  return 'image/jpeg'; // default
}

// ─── Tesseract Fallback ─────────────────────────────────────────

let tesseractWorker: Tesseract.Worker | null = null;

async function getWorker(): Promise<Tesseract.Worker> {
  if (!tesseractWorker) {
    tesseractWorker = await Tesseract.createWorker('eng', undefined, {
      logger: process.env.NODE_ENV === 'development' ? (m: unknown) => console.log('[OCR]', m) : undefined,
    });
    console.log('[OCR] Tesseract worker initialized');
  }
  return tesseractWorker;
}

export async function shutdownOcr(): Promise<void> {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
    console.log('[OCR] Tesseract worker terminated');
  }
}

async function processReceiptWithTesseract(imageBuffer: Buffer): Promise<OcrResult> {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageBuffer);
  const rawText = data.text;
  const confidence = data.confidence;

  const vendor = extractVendor(rawText);
  const amount = extractAmount(rawText);
  const date = extractDate(rawText);
  const category = inferCategory(rawText, vendor);

  return { rawText, vendor, amount, date, category, confidence, lineItems: [], engine: 'tesseract' };
}

// ─── Main Entry Point ───────────────────────────────────────────

export async function processReceiptImage(imageBuffer: Buffer): Promise<OcrResult> {
  // Use Claude Vision if API key is available
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await processReceiptWithClaude(imageBuffer);
      console.log(`[OCR] Claude Vision extracted: vendor=${result.vendor}, amount=${result.amount}, items=${result.lineItems.length}`);
      return result;
    } catch (err: unknown) {
      console.warn('[OCR] Claude Vision failed, falling back to Tesseract:', err instanceof Error ? err.message : err);
    }
  }

  // Fallback to Tesseract
  return processReceiptWithTesseract(imageBuffer);
}

// ─── Amount Extraction (Tesseract fallback) ─────────────────────

function extractAmount(text: string): number | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const totalPatterns = [
    /(?:grand\s*total|total\s*(?:due|amount|charged|sale)|amount\s*due|balance\s*due)[:\s]*\$?\s*(\d{1,6}[.,]\d{2})/i,
    /(?:total)[:\s]*\$?\s*(\d{1,6}[.,]\d{2})/i,
  ];

  for (const pattern of totalPatterns) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match) {
        const val = parseFloat(match[1].replace(',', '.'));
        if (val > 0 && val < 100000) return Math.round(val * 100) / 100;
      }
    }
  }

  const dollarPattern = /\$\s*(\d{1,6}[.,]\d{2})/g;
  let largest = 0;
  for (const line of lines) {
    let match;
    while ((match = dollarPattern.exec(line)) !== null) {
      const val = parseFloat(match[1].replace(',', '.'));
      if (val > largest && val < 100000) largest = val;
    }
  }

  return largest > 0 ? Math.round(largest * 100) / 100 : null;
}

// ─── Date Extraction (Tesseract fallback) ───────────────────────

function extractDate(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const slashDate = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
  const monthNames = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
  const namedDate = new RegExp(`(${monthNames})\\w*\\.?\\s+(\\d{1,2}),?\\s*(\\d{4})`, 'i');
  const isoDate = /(\d{4})-(\d{2})-(\d{2})/;

  for (const line of lines) {
    const isoMatch = line.match(isoDate);
    if (isoMatch) {
      const d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`);
      if (isReasonableDate(d)) return formatDate(d);
    }

    const namedMatch = line.match(namedDate);
    if (namedMatch) {
      const d = new Date(`${namedMatch[1]} ${namedMatch[2]}, ${namedMatch[3]}`);
      if (isReasonableDate(d)) return formatDate(d);
    }

    const slashMatch = line.match(slashDate);
    if (slashMatch) {
      let year = parseInt(slashMatch[3]);
      if (year < 100) year += 2000;
      const month = parseInt(slashMatch[1]);
      const day = parseInt(slashMatch[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const d = new Date(year, month - 1, day);
        if (isReasonableDate(d)) return formatDate(d);
      }
    }
  }

  return null;
}

function isReasonableDate(d: Date): boolean {
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const oneYearAhead = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  return d >= oneYearAgo && d <= oneYearAhead && !isNaN(d.getTime());
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Vendor Extraction (Tesseract fallback) ─────────────────────

function extractVendor(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2 && l.length < 80);

  const skipPatterns = [
    /^\d{3}[\s.-]\d{3}[\s.-]\d{4}/,
    /^\d{1,5}\s+\w+\s+(st|ave|blvd|rd|dr|ln|ct|way|pike|hwy)/i,
    /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,
    /^\$/,
    /^(total|subtotal|tax|tip|change|cash|credit|visa|mastercard|amex|debit)/i,
    /^(thank|welcome|receipt|order|transaction|authorization|auth)/i,
    /^\d+$/,
    /^[#*\-=]+$/,
  ];

  for (const line of lines) {
    const isSkip = skipPatterns.some(p => p.test(line));
    if (!isSkip && /[a-zA-Z]/.test(line)) {
      return line.replace(/[^\w\s'&\-.]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
    }
  }

  return null;
}

// ─── Category Inference (Tesseract fallback) ────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  lodging: ['hotel', 'inn', 'suites', 'marriott', 'hilton', 'hyatt', 'ihg', 'wyndham', 'airbnb', 'motel', 'resort', 'lodge', 'courtyard', 'hampton', 'sheraton', 'westin', 'fairfield', 'doubletree', 'embassy'],
  meals: ['restaurant', 'cafe', 'diner', 'grill', 'kitchen', 'pizza', 'burger', 'sushi', 'taco', 'sandwich', 'coffee', 'starbucks', 'mcdonalds', 'subway', 'chipotle', 'panera', 'chick-fil-a', 'wendy', 'breakfast', 'lunch', 'dinner', 'bistro', 'eatery', 'food'],
  transport: ['uber', 'lyft', 'taxi', 'cab', 'rental', 'hertz', 'avis', 'enterprise', 'national', 'budget', 'gas', 'shell', 'exxon', 'bp', 'chevron', 'citgo', 'flight', 'airline', 'delta', 'united', 'american', 'southwest', 'jetblue', 'amtrak', 'transit'],
  parking: ['parking', 'garage', 'valet', 'lot', 'meter', 'park'],
  tips: ['tip', 'gratuity'],
};

function inferCategory(text: string, vendor: string | null): string | null {
  const combined = `${text} ${vendor || ''}`.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (combined.includes(kw)) return category;
    }
  }

  return 'other';
}
