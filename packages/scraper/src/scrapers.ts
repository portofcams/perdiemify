import * as cheerio from 'cheerio';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

interface ScrapedCode {
  code: string;
  provider: string;
  type: 'percent' | 'fixed' | 'promo';
  value: number | null;
  description: string | null;
  source: string;
  sourceUrl: string;
  applicableTo: string;
  expiresAt: Date | null;
}

interface ScrapeResult {
  source: string;
  status: 'success' | 'error';
  codesFound: number;
  codesNew: number;
  durationMs: number;
  errorMessage: string | null;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// --- Source scrapers ---

async function scrapeGovTravelDiscounts(): Promise<ScrapedCode[]> {
  // Curated government/military travel discounts that we know exist
  // These are well-known programs, not scraped from any specific site
  const codes: ScrapedCode[] = [
    {
      code: 'GOVRATE',
      provider: 'Marriott',
      type: 'promo',
      value: null,
      description: 'Government per diem rate — available at most Marriott properties with valid .gov/.mil ID',
      source: 'curated',
      sourceUrl: 'https://www.marriott.com',
      applicableTo: 'hotel',
      expiresAt: null,
    },
    {
      code: 'GOVRATE',
      provider: 'Hilton',
      type: 'promo',
      value: null,
      description: 'Government per diem rate — book through FedRooms or direct with .gov/.mil email',
      source: 'curated',
      sourceUrl: 'https://www.hilton.com',
      applicableTo: 'hotel',
      expiresAt: null,
    },
    {
      code: 'GOVRATE',
      provider: 'IHG',
      type: 'promo',
      value: null,
      description: 'Government rate — available at Holiday Inn, Crowne Plaza, and other IHG brands',
      source: 'curated',
      sourceUrl: 'https://www.ihg.com',
      applicableTo: 'hotel',
      expiresAt: null,
    },
    {
      code: 'FEDROOMS',
      provider: 'FedRooms',
      type: 'promo',
      value: null,
      description: 'GSA-negotiated hotel rates at or below per diem — fedrooms.com',
      source: 'curated',
      sourceUrl: 'https://www.fedrooms.com',
      applicableTo: 'hotel',
      expiresAt: null,
    },
    {
      code: 'MILGOV',
      provider: 'National Car Rental',
      type: 'percent',
      value: 20,
      description: 'Up to 20% off for military and government — use contract ID',
      source: 'curated',
      sourceUrl: 'https://www.nationalcar.com',
      applicableTo: 'car',
      expiresAt: null,
    },
    {
      code: 'USGOVT',
      provider: 'Enterprise',
      type: 'percent',
      value: 15,
      description: 'Government discount — compact and midsize from $36/day',
      source: 'curated',
      sourceUrl: 'https://www.enterprise.com',
      applicableTo: 'car',
      expiresAt: null,
    },
  ];

  return codes;
}

async function scrapeRetailMeNot(provider: string, url: string): Promise<ScrapedCode[]> {
  const codes: ScrapedCode[] = [];

  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    // RetailMeNot typically has coupon cards with code and description
    $('[data-testid="coupon-card"], .offer-card, .coupon').each((_, el) => {
      const codeEl = $(el).find('[data-testid="code"], .code, .coupon-code');
      const descEl = $(el).find('[data-testid="offer-title"], .offer-title, .description');

      const code = codeEl.text().trim();
      const desc = descEl.text().trim();

      if (code && code.length >= 3 && code.length <= 30 && !code.includes(' ')) {
        const percentMatch = desc.match(/(\d+)%\s*off/i);
        const dollarMatch = desc.match(/\$(\d+)\s*off/i);

        codes.push({
          code,
          provider,
          type: percentMatch ? 'percent' : dollarMatch ? 'fixed' : 'promo',
          value: percentMatch ? parseInt(percentMatch[1]) : dollarMatch ? parseInt(dollarMatch[1]) : null,
          description: desc || null,
          source: 'retailmenot',
          sourceUrl: url,
          applicableTo: 'hotel',
          expiresAt: null,
        });
      }
    });
  } catch (err) {
    console.warn(`RetailMeNot scrape failed for ${provider}:`, err instanceof Error ? err.message : err);
  }

  return codes;
}

async function scrapeCouponSites(): Promise<ScrapedCode[]> {
  const allCodes: ScrapedCode[] = [];

  const targets = [
    { provider: 'Hotels.com', url: 'https://www.retailmenot.com/view/hotels.com' },
    { provider: 'Expedia', url: 'https://www.retailmenot.com/view/expedia.com' },
    { provider: 'Booking.com', url: 'https://www.retailmenot.com/view/booking.com' },
    { provider: 'Priceline', url: 'https://www.retailmenot.com/view/priceline.com' },
  ];

  for (const target of targets) {
    const codes = await scrapeRetailMeNot(target.provider, target.url);
    allCodes.push(...codes);
    // Polite delay between requests
    await new Promise((r) => setTimeout(r, 2000));
  }

  return allCodes;
}

// --- Database operations ---

async function upsertCodes(db: PostgresJsDatabase, codes: ScrapedCode[]): Promise<number> {
  if (codes.length === 0) return 0;

  let newCount = 0;

  for (const code of codes) {
    try {
      const result = await db.execute(sql`
        INSERT INTO discount_codes (id, code, provider, type, value, description, source, source_url, applicable_to, expires_at, is_validated, success_rate, upvotes, downvotes, created_at)
        VALUES (gen_random_uuid(), ${code.code}, ${code.provider}, ${code.type}, ${code.value}, ${code.description}, ${code.source}, ${code.sourceUrl}, ${code.applicableTo}, ${code.expiresAt}, false, 0, 0, 0, NOW())
        ON CONFLICT DO NOTHING
      `);
      // postgres.js returns the number of affected rows
      if (result && (result as unknown[]).length === 0) {
        // ON CONFLICT DO NOTHING means 0 rows = duplicate
      } else {
        newCount++;
      }
    } catch (err) {
      // Skip duplicates silently, log other errors
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('duplicate') && !msg.includes('unique')) {
        console.warn('Insert code error:', msg);
      }
    }
  }

  return newCount;
}

async function logScrapeRun(db: PostgresJsDatabase, result: ScrapeResult): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO scraper_logs (id, source, status, codes_found, codes_new, duration_ms, error_message, run_at)
      VALUES (gen_random_uuid(), ${result.source}, ${result.status}, ${result.codesFound}, ${result.codesNew}, ${result.durationMs}, ${result.errorMessage}, NOW())
    `);
  } catch (err) {
    console.warn('Failed to log scrape run:', err);
  }
}

// --- Main orchestrator ---

export async function scrapeAllSources(db: PostgresJsDatabase): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];

  // 1. Curated government/military discounts
  const govStart = Date.now();
  try {
    const govCodes = await scrapeGovTravelDiscounts();
    const newCodes = await upsertCodes(db, govCodes);
    const result: ScrapeResult = {
      source: 'gov-travel-curated',
      status: 'success',
      codesFound: govCodes.length,
      codesNew: newCodes,
      durationMs: Date.now() - govStart,
      errorMessage: null,
    };
    results.push(result);
    await logScrapeRun(db, result);
  } catch (err) {
    const result: ScrapeResult = {
      source: 'gov-travel-curated',
      status: 'error',
      codesFound: 0,
      codesNew: 0,
      durationMs: Date.now() - govStart,
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    };
    results.push(result);
    await logScrapeRun(db, result);
  }

  // 2. Coupon site scraping (RetailMeNot)
  const couponStart = Date.now();
  try {
    const couponCodes = await scrapeCouponSites();
    const newCodes = await upsertCodes(db, couponCodes);
    const result: ScrapeResult = {
      source: 'retailmenot',
      status: 'success',
      codesFound: couponCodes.length,
      codesNew: newCodes,
      durationMs: Date.now() - couponStart,
      errorMessage: null,
    };
    results.push(result);
    await logScrapeRun(db, result);
  } catch (err) {
    const result: ScrapeResult = {
      source: 'retailmenot',
      status: 'error',
      codesFound: 0,
      codesNew: 0,
      durationMs: Date.now() - couponStart,
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    };
    results.push(result);
    await logScrapeRun(db, result);
  }

  return results;
}
