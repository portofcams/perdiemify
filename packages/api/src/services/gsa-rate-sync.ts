import { sql } from 'drizzle-orm';
import { db } from '../db';
import { perdiemRates } from '../db/schema';
import { getCurrentFiscalYear, GSA_API_BASE } from '@perdiemify/shared';

const API_KEY = process.env.GSA_API_KEY || 'DEMO_KEY';

// All 50 states + DC — used for bulk sync
const ALL_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL',
  'GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
  'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

interface GSAMonth {
  value: number;
  number: number;
  short: string;
  long: string;
}

interface GSARate {
  months: { month: GSAMonth[] };
  meals: number;
  zip: string | null;
  county: string;
  city: string;
  standardRate: string;
}

interface GSARatesResponse {
  rates: Array<{
    rate: GSARate[];
    state: string;
    year: number;
    isOconus: string;
  }>;
}

interface SyncResult {
  state: string;
  ratesInserted: number;
  durationMs: number;
  error: string | null;
}

/**
 * Fetch all per diem rates for a single state from GSA API.
 * Includes retry logic for 429 rate limits.
 */
async function fetchStateRates(state: string, fiscalYear: number): Promise<Array<{
  fiscalYear: number;
  state: string;
  city: string;
  county: string | null;
  lodgingRate: number;
  mieRate: number;
  month: number;
}>> {
  const url = `${GSA_API_BASE}/rates/state/${encodeURIComponent(state)}/year/${fiscalYear}?api_key=${API_KEY}`;

  // Retry up to 3 times for rate limits (429)
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
    });

    if (res.status === 429) {
      // Rate limited — back off exponentially: 5s, 15s, 45s
      const delay = 5000 * Math.pow(3, attempt);
      console.warn(`[PerDiemSync] Rate limited on ${state}, retrying in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
      lastError = new Error(`GSA API 429 for ${state}`);
      continue;
    }

    if (!res.ok) {
      throw new Error(`GSA API ${res.status} for ${state}`);
    }

    const data = await res.json() as GSARatesResponse;

    if (!data.rates || data.rates.length === 0) {
      return [];
    }

    const results: Array<{
      fiscalYear: number;
      state: string;
      city: string;
      county: string | null;
      lodgingRate: number;
      mieRate: number;
      month: number;
    }> = [];

    for (const rateGroup of data.rates) {
      for (const rate of rateGroup.rate) {
        for (const month of rate.months.month) {
          results.push({
            fiscalYear: rateGroup.year,
            state: rateGroup.state,
            city: rate.city,
            county: rate.county || null,
            lodgingRate: month.value,
            mieRate: rate.meals,
            month: month.number,
          });
        }
      }
    }

    return results;
  }

  // All retries exhausted
  throw lastError || new Error(`GSA API failed for ${state} after 3 attempts`);
}

/**
 * Upsert rates into DB using batch inserts with ON CONFLICT.
 */
async function upsertRates(rates: Array<{
  fiscalYear: number;
  state: string;
  city: string;
  county: string | null;
  lodgingRate: number;
  mieRate: number;
  month: number;
}>): Promise<number> {
  if (rates.length === 0) return 0;

  let inserted = 0;

  // Batch insert in chunks of 100 to avoid parameter limits
  const chunkSize = 100;
  for (let i = 0; i < rates.length; i += chunkSize) {
    const chunk = rates.slice(i, i + chunkSize);

    // Build VALUES clause dynamically
    const values = chunk
      .map(
        (r) =>
          `(gen_random_uuid(), ${r.fiscalYear}, '${r.state}', '${r.city.replace(/'/g, "''")}', ${r.county ? `'${r.county.replace(/'/g, "''")}'` : 'NULL'}, ${r.lodgingRate}, ${r.mieRate}, ${r.month})`
      )
      .join(',\n');

    try {
      await db.execute(sql.raw(`
        INSERT INTO perdiem_rates (id, fiscal_year, state, city, county, lodging_rate, mie_rate, month)
        VALUES ${values}
        ON CONFLICT (fiscal_year, state, city, county, month)
        DO UPDATE SET
          lodging_rate = EXCLUDED.lodging_rate,
          mie_rate = EXCLUDED.mie_rate
      `));
      inserted += chunk.length;
    } catch (err) {
      console.error(`Failed to upsert rates batch (${chunk.length} rows):`, err instanceof Error ? err.message : err);
    }
  }

  return inserted;
}

/**
 * Sync all GSA per diem rates for the current fiscal year.
 *
 * Fetches rates state-by-state to avoid overwhelming the GSA API,
 * then upserts into the `perdiem_rates` table.
 *
 * Returns summary of sync results per state.
 */
export async function syncAllPerDiemRates(fiscalYear?: number): Promise<{
  totalRatesInserted: number;
  totalStates: number;
  successStates: number;
  failedStates: string[];
  durationMs: number;
  results: SyncResult[];
}> {
  const fy = fiscalYear || getCurrentFiscalYear();
  const overallStart = Date.now();
  const results: SyncResult[] = [];
  let totalInserted = 0;
  const failedStates: string[] = [];

  console.log(`[PerDiemSync] Starting sync for FY${fy} across ${ALL_STATES.length} states...`);

  for (const state of ALL_STATES) {
    const stateStart = Date.now();
    try {
      const rates = await fetchStateRates(state, fy);
      const inserted = await upsertRates(rates);
      totalInserted += inserted;

      results.push({
        state,
        ratesInserted: inserted,
        durationMs: Date.now() - stateStart,
        error: null,
      });

      // Rate limit: ~1 req per 2 sec for DEMO_KEY safety
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      failedStates.push(state);
      results.push({
        state,
        ratesInserted: 0,
        durationMs: Date.now() - stateStart,
        error,
      });
      console.error(`[PerDiemSync] Failed for ${state}: ${error}`);

      // Longer delay on failure before trying next state
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  const durationMs = Date.now() - overallStart;
  const successStates = ALL_STATES.length - failedStates.length;

  console.log(`[PerDiemSync] Complete: ${totalInserted} rates across ${successStates}/${ALL_STATES.length} states in ${(durationMs / 1000).toFixed(1)}s`);
  if (failedStates.length > 0) {
    console.warn(`[PerDiemSync] Failed states: ${failedStates.join(', ')}`);
  }

  return {
    totalRatesInserted: totalInserted,
    totalStates: ALL_STATES.length,
    successStates,
    failedStates,
    durationMs,
    results,
  };
}

/**
 * Get the count of cached rates for a given fiscal year.
 * Useful for health checks and deciding whether to trigger a sync.
 */
export async function getCachedRateCount(fiscalYear?: number): Promise<number> {
  const fy = fiscalYear || getCurrentFiscalYear();
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(perdiemRates)
    .where(sql`fiscal_year = ${fy}`);

  return result?.count ?? 0;
}
