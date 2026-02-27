import * as cheerio from 'cheerio';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

// --- Types ---

export interface ScrapedCode {
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

export interface ScrapeResult {
  source: string;
  status: 'success' | 'error';
  codesFound: number;
  codesNew: number;
  durationMs: number;
  errorMessage: string | null;
}

// --- User agents for rotation ---

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// --- BaseScraper abstract class ---

abstract class BaseScraper {
  abstract name: string;
  abstract source: string;

  protected maxRetries = 2;
  protected timeoutMs = 15_000;
  protected delayBetweenMs = 2000;

  abstract scrape(): Promise<ScrapedCode[]>;

  protected async fetchPage(url: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': randomUA(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Cache-Control': 'no-cache',
          },
          signal: AbortSignal.timeout(this.timeoutMs),
          redirect: 'follow',
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }

        return res.text();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) {
          // Exponential backoff: 2s, 4s
          await this.delay(this.delayBetweenMs * (attempt + 1));
        }
      }
    }

    throw lastError || new Error('Fetch failed');
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  protected parsePercentOrDollar(text: string): { type: 'percent' | 'fixed' | 'promo'; value: number | null } {
    const percentMatch = text.match(/(\d+)%\s*off/i);
    const dollarMatch = text.match(/\$(\d+)\s*off/i);
    if (percentMatch) return { type: 'percent', value: parseInt(percentMatch[1]) };
    if (dollarMatch) return { type: 'fixed', value: parseInt(dollarMatch[1]) };
    return { type: 'promo', value: null };
  }
}

// --- Government & Military curated codes ---

class GovTravelScraper extends BaseScraper {
  name = 'Government/Military Travel';
  source = 'gov-travel-curated';

  async scrape(): Promise<ScrapedCode[]> {
    return [
      { code: 'GOVRATE', provider: 'Marriott', type: 'promo', value: null, description: 'Government per diem rate — available at most Marriott properties with valid .gov/.mil ID', source: 'curated', sourceUrl: 'https://www.marriott.com', applicableTo: 'hotel', expiresAt: null },
      { code: 'GOVRATE', provider: 'Hilton', type: 'promo', value: null, description: 'Government per diem rate — book through FedRooms or direct with .gov/.mil email', source: 'curated', sourceUrl: 'https://www.hilton.com', applicableTo: 'hotel', expiresAt: null },
      { code: 'GOVRATE', provider: 'IHG', type: 'promo', value: null, description: 'Government rate — available at Holiday Inn, Crowne Plaza, and other IHG brands', source: 'curated', sourceUrl: 'https://www.ihg.com', applicableTo: 'hotel', expiresAt: null },
      { code: 'GOVRATE', provider: 'Hyatt', type: 'promo', value: null, description: 'Government rate — available at Hyatt Place, Hyatt House, and other Hyatt brands', source: 'curated', sourceUrl: 'https://www.hyatt.com', applicableTo: 'hotel', expiresAt: null },
      { code: 'GOVRATE', provider: 'Wyndham', type: 'promo', value: null, description: 'Government rate — La Quinta, Wyndham, Days Inn, and Ramada brands', source: 'curated', sourceUrl: 'https://www.wyndhamhotels.com', applicableTo: 'hotel', expiresAt: null },
      { code: 'FEDROOMS', provider: 'FedRooms', type: 'promo', value: null, description: 'GSA-negotiated hotel rates at or below per diem — fedrooms.com', source: 'curated', sourceUrl: 'https://www.fedrooms.com', applicableTo: 'hotel', expiresAt: null },
      { code: 'MILGOV', provider: 'National Car Rental', type: 'percent', value: 20, description: 'Up to 20% off for military and government — use contract ID', source: 'curated', sourceUrl: 'https://www.nationalcar.com', applicableTo: 'car', expiresAt: null },
      { code: 'USGOVT', provider: 'Enterprise', type: 'percent', value: 15, description: 'Government discount — compact and midsize from $36/day', source: 'curated', sourceUrl: 'https://www.enterprise.com', applicableTo: 'car', expiresAt: null },
      { code: 'USGOV', provider: 'Hertz', type: 'percent', value: 15, description: 'Government rate — CDP code available for federal employees', source: 'curated', sourceUrl: 'https://www.hertz.com', applicableTo: 'car', expiresAt: null },
      { code: 'AAFES', provider: 'Avis', type: 'percent', value: 25, description: 'Military/AAFES discount — up to 25% off base rates', source: 'curated', sourceUrl: 'https://www.avis.com', applicableTo: 'car', expiresAt: null },
    ];
  }
}

// --- RetailMeNot scraper ---

class RetailMeNotScraper extends BaseScraper {
  name = 'RetailMeNot';
  source = 'retailmenot';

  private targets = [
    { provider: 'Hotels.com', url: 'https://www.retailmenot.com/view/hotels.com', applicableTo: 'hotel' },
    { provider: 'Expedia', url: 'https://www.retailmenot.com/view/expedia.com', applicableTo: 'hotel' },
    { provider: 'Booking.com', url: 'https://www.retailmenot.com/view/booking.com', applicableTo: 'hotel' },
    { provider: 'Priceline', url: 'https://www.retailmenot.com/view/priceline.com', applicableTo: 'hotel' },
    { provider: 'Kayak', url: 'https://www.retailmenot.com/view/kayak.com', applicableTo: 'flight' },
  ];

  async scrape(): Promise<ScrapedCode[]> {
    const allCodes: ScrapedCode[] = [];

    for (const target of this.targets) {
      try {
        const html = await this.fetchPage(target.url);
        const $ = cheerio.load(html);

        $('[data-testid="coupon-card"], .offer-card, .coupon').each((_, el) => {
          const codeEl = $(el).find('[data-testid="code"], .code, .coupon-code');
          const descEl = $(el).find('[data-testid="offer-title"], .offer-title, .description');

          const code = codeEl.text().trim();
          const desc = descEl.text().trim();

          if (code && code.length >= 3 && code.length <= 30 && !code.includes(' ')) {
            const parsed = this.parsePercentOrDollar(desc);
            allCodes.push({
              code,
              provider: target.provider,
              ...parsed,
              description: desc || null,
              source: this.source,
              sourceUrl: target.url,
              applicableTo: target.applicableTo,
              expiresAt: null,
            });
          }
        });
      } catch (err) {
        console.warn(`RetailMeNot scrape failed for ${target.provider}:`, err instanceof Error ? err.message : err);
      }

      await this.delay(this.delayBetweenMs);
    }

    return allCodes;
  }
}

// --- Hotel chain direct offer scraper ---

class HotelChainScraper extends BaseScraper {
  name = 'Hotel Chain Offers';
  source = 'hotel-chain-offers';

  // Curated current promotions from major chains
  // These are publicly advertised promos — not scraped dynamically
  async scrape(): Promise<ScrapedCode[]> {
    return [
      { code: 'AAA', provider: 'Marriott', type: 'percent', value: 12, description: 'AAA/CAA member discount — 12% off best available rate', source: this.source, sourceUrl: 'https://www.marriott.com', applicableTo: 'hotel', expiresAt: null },
      { code: 'AAA', provider: 'Hilton', type: 'percent', value: 10, description: 'AAA member discount — 10% off best available rate', source: this.source, sourceUrl: 'https://www.hilton.com', applicableTo: 'hotel', expiresAt: null },
      { code: 'SENIOR', provider: 'Marriott', type: 'percent', value: 15, description: 'Senior discount (62+) — up to 15% off', source: this.source, sourceUrl: 'https://www.marriott.com', applicableTo: 'hotel', expiresAt: null },
      { code: 'SENIOR', provider: 'Hilton', type: 'percent', value: 10, description: 'Senior discount (65+) — 10% off', source: this.source, sourceUrl: 'https://www.hilton.com', applicableTo: 'hotel', expiresAt: null },
      { code: 'ADVANCE', provider: 'IHG', type: 'percent', value: 20, description: 'Advance purchase — book 7+ days ahead, save up to 20%', source: this.source, sourceUrl: 'https://www.ihg.com', applicableTo: 'hotel', expiresAt: null },
      { code: 'LONGSTAY', provider: 'Hilton', type: 'percent', value: 15, description: 'Extended stay — 5+ nights, up to 15% off nightly rate', source: this.source, sourceUrl: 'https://www.hilton.com', applicableTo: 'hotel', expiresAt: null },
      { code: 'WEEKNIGHT', provider: 'Hyatt', type: 'promo', value: null, description: 'Weeknight special — Sun–Thu rates often 10-20% lower than weekends', source: this.source, sourceUrl: 'https://www.hyatt.com', applicableTo: 'hotel', expiresAt: null },
    ];
  }
}

// --- SlickDeals travel scraper ---

class SlickDealsScraper extends BaseScraper {
  name = 'SlickDeals Travel';
  source = 'slickdeals';

  async scrape(): Promise<ScrapedCode[]> {
    const codes: ScrapedCode[] = [];

    try {
      const html = await this.fetchPage('https://slickdeals.net/deals/travel/');
      const $ = cheerio.load(html);

      // SlickDeals has deal cards with titles and sometimes promo codes
      $('.dealCard, .bp-p-dealCard, [data-testid="deal-card"]').each((_, el) => {
        const title = $(el).find('.dealCard__title, .bp-c-card_title, a').first().text().trim();
        const link = $(el).find('a').first().attr('href') || '';

        // Look for codes in the title (e.g., "Use code SAVE20")
        const codeMatch = title.match(/(?:code|promo|coupon)\s+[:\-]?\s*([A-Z0-9]{3,20})/i);

        if (codeMatch) {
          const parsed = this.parsePercentOrDollar(title);
          // Determine applicableTo from keywords
          let applicableTo = 'all';
          if (/hotel|lodging|stay/i.test(title)) applicableTo = 'hotel';
          else if (/flight|airline|airfare/i.test(title)) applicableTo = 'flight';
          else if (/car|rental|rent/i.test(title)) applicableTo = 'car';

          codes.push({
            code: codeMatch[1].toUpperCase(),
            provider: this.extractProvider(title),
            ...parsed,
            description: title.slice(0, 200),
            source: this.source,
            sourceUrl: link.startsWith('http') ? link : `https://slickdeals.net${link}`,
            applicableTo,
            expiresAt: null,
          });
        }
      });
    } catch (err) {
      console.warn('SlickDeals scrape failed:', err instanceof Error ? err.message : err);
    }

    return codes;
  }

  private extractProvider(title: string): string {
    const providers = ['Marriott', 'Hilton', 'IHG', 'Hyatt', 'Wyndham', 'Hotels.com', 'Expedia', 'Booking.com', 'Priceline', 'Southwest', 'Delta', 'United', 'American', 'JetBlue', 'Hertz', 'National', 'Enterprise', 'Avis', 'Budget'];
    for (const p of providers) {
      if (title.toLowerCase().includes(p.toLowerCase())) return p;
    }
    return 'Various';
  }
}

// --- Database operations ---

async function upsertCodes(db: PostgresJsDatabase, codes: ScrapedCode[]): Promise<number> {
  if (codes.length === 0) return 0;

  let newCount = 0;

  for (const code of codes) {
    try {
      await db.execute(sql`
        INSERT INTO discount_codes (id, code, provider, type, value, description, source, source_url, applicable_to, expires_at, is_validated, success_rate, upvotes, downvotes, created_at)
        VALUES (gen_random_uuid(), ${code.code}, ${code.provider}, ${code.type}, ${code.value}, ${code.description}, ${code.source}, ${code.sourceUrl}, ${code.applicableTo}, ${code.expiresAt}, false, 0, 0, 0, NOW())
        ON CONFLICT DO NOTHING
      `);
      newCount++;
    } catch (err) {
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
  const scrapers: BaseScraper[] = [
    new GovTravelScraper(),
    new RetailMeNotScraper(),
    new HotelChainScraper(),
    new SlickDealsScraper(),
  ];

  const results: ScrapeResult[] = [];

  for (const scraper of scrapers) {
    const start = Date.now();
    try {
      console.log(`[Scraper] Running: ${scraper.name}`);
      const codes = await scraper.scrape();
      const newCodes = await upsertCodes(db, codes);
      const result: ScrapeResult = {
        source: scraper.source,
        status: 'success',
        codesFound: codes.length,
        codesNew: newCodes,
        durationMs: Date.now() - start,
        errorMessage: null,
      };
      results.push(result);
      await logScrapeRun(db, result);
      console.log(`[Scraper] ${scraper.name}: ${codes.length} found, ${newCodes} new (${Date.now() - start}ms)`);
    } catch (err) {
      const result: ScrapeResult = {
        source: scraper.source,
        status: 'error',
        codesFound: 0,
        codesNew: 0,
        durationMs: Date.now() - start,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      };
      results.push(result);
      await logScrapeRun(db, result);
      console.error(`[Scraper] ${scraper.name} failed:`, err instanceof Error ? err.message : err);
    }
  }

  return results;
}
