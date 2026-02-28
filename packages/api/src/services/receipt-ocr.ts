/**
 * Receipt OCR Service — Phase 4
 *
 * Uses Tesseract.js to extract text from receipt images,
 * then parses vendor, amount, date, and category.
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
}

// ─── Singleton Tesseract Worker ──────────────────────────────────

let tesseractWorker: Tesseract.Worker | null = null;

async function getWorker(): Promise<Tesseract.Worker> {
  if (!tesseractWorker) {
    tesseractWorker = await Tesseract.createWorker('eng', undefined, {
      // Reduce logging in production
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

// ─── Main OCR Function ──────────────────────────────────────────

export async function processReceiptImage(imageBuffer: Buffer): Promise<OcrResult> {
  const worker = await getWorker();

  const { data } = await worker.recognize(imageBuffer);
  const rawText = data.text;
  const confidence = data.confidence;

  const vendor = extractVendor(rawText);
  const amount = extractAmount(rawText);
  const date = extractDate(rawText);
  const category = inferCategory(rawText, vendor);

  return { rawText, vendor, amount, date, category, confidence };
}

// ─── Amount Extraction ──────────────────────────────────────────

function extractAmount(text: string): number | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Priority 1: Look for total lines (most accurate)
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

  // Priority 2: Find the largest dollar amount on the receipt
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

// ─── Date Extraction ────────────────────────────────────────────

function extractDate(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Pattern: MM/DD/YYYY or MM-DD-YYYY
  const slashDate = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
  // Pattern: Month DD, YYYY
  const monthNames = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
  const namedDate = new RegExp(`(${monthNames})\\w*\\.?\\s+(\\d{1,2}),?\\s*(\\d{4})`, 'i');
  // Pattern: YYYY-MM-DD (ISO)
  const isoDate = /(\d{4})-(\d{2})-(\d{2})/;

  for (const line of lines) {
    // ISO date
    const isoMatch = line.match(isoDate);
    if (isoMatch) {
      const d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`);
      if (isReasonableDate(d)) return formatDate(d);
    }

    // Named date
    const namedMatch = line.match(namedDate);
    if (namedMatch) {
      const d = new Date(`${namedMatch[1]} ${namedMatch[2]}, ${namedMatch[3]}`);
      if (isReasonableDate(d)) return formatDate(d);
    }

    // Slash/dash date
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

// ─── Vendor Extraction ──────────────────────────────────────────

function extractVendor(text: string): string | null {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2 && l.length < 80);

  // Skip lines that look like addresses, phone numbers, dates, or amounts
  const skipPatterns = [
    /^\d{3}[\s.-]\d{3}[\s.-]\d{4}/, // phone
    /^\d{1,5}\s+\w+\s+(st|ave|blvd|rd|dr|ln|ct|way|pike|hwy)/i, // address
    /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/, // date
    /^\$/, // dollar amount
    /^(total|subtotal|tax|tip|change|cash|credit|visa|mastercard|amex|debit)/i,
    /^(thank|welcome|receipt|order|transaction|authorization|auth)/i,
    /^\d+$/, // pure numbers
    /^[#*\-=]+$/, // divider lines
  ];

  for (const line of lines) {
    const isSkip = skipPatterns.some(p => p.test(line));
    if (!isSkip && /[a-zA-Z]/.test(line)) {
      // Clean up the vendor name
      return line
        .replace(/[^\w\s'&\-.]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
    }
  }

  return null;
}

// ─── Category Inference ─────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  lodging: ['hotel', 'inn', 'suites', 'marriott', 'hilton', 'hyatt', 'ihg', 'wyndham', 'airbnb', 'motel', 'resort', 'lodge', 'courtyard', 'hampton', 'sheraton', 'westin', 'fairfield', 'doubletree', 'embassy'],
  meals: ['restaurant', 'cafe', 'diner', 'grill', 'kitchen', 'pizza', 'burger', 'sushi', 'taco', 'sandwich', 'coffee', 'starbucks', 'mcdonalds', 'subway', 'chipotle', 'panera', 'chick-fil-a', 'wendy', 'breakfast', 'lunch', 'dinner', 'bistro', 'eatery', 'food'],
  transport: ['uber', 'lyft', 'taxi', 'cab', 'rental', 'hertz', 'avis', 'enterprise', 'national', 'budget', 'gas', 'shell', 'exxon', 'bp', 'chevron', 'citgo', 'flight', 'airline', 'delta', 'united', 'american', 'southwest', 'jetblue', 'amtrak', 'transit'],
  parking: ['parking', 'garage', 'valet', 'lot', 'meter', 'park'],
  tips: ['tip', 'gratuity'],
};

function inferCategory(text: string, vendor: string | null): string | null {
  const combined = `${text} ${vendor || ''}`.toLowerCase();

  // Check categories in priority order
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (combined.includes(kw)) return category;
    }
  }

  return 'other';
}
