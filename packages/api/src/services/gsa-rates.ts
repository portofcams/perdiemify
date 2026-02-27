import type { PerDiemRate } from '@perdiemify/shared';
import { getCurrentFiscalYear } from '@perdiemify/shared';

const GSA_API_BASE = 'https://api.gsa.gov/travel/perdiem/v2';
const API_KEY = process.env.GSA_API_KEY || 'DEMO_KEY';

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

export async function fetchGSARates(
  city: string,
  state: string,
  year?: number
): Promise<PerDiemRate[]> {
  const fiscalYear = year || getCurrentFiscalYear();
  const url = `${GSA_API_BASE}/rates/city/${encodeURIComponent(city)}/state/${encodeURIComponent(state)}/year/${fiscalYear}?api_key=${API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GSA API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as GSARatesResponse;

  if (!data.rates || data.rates.length === 0) {
    return [];
  }

  const results: PerDiemRate[] = [];

  for (const rateGroup of data.rates) {
    for (const rate of rateGroup.rate) {
      // Create a rate entry for each month (lodging varies by season)
      for (const month of rate.months.month) {
        results.push({
          id: '',
          fiscalYear: rateGroup.year,
          state: rateGroup.state,
          city: rate.city,
          county: rate.county,
          lodgingRate: month.value,
          mieRate: rate.meals,
          month: month.number,
          effectiveDate: null,
        });
      }
    }
  }

  return results;
}

export async function fetchGSARateForDate(
  city: string,
  state: string,
  date: string
): Promise<{ lodgingRate: number; mieRate: number } | null> {
  const d = new Date(date);
  const month = d.getMonth() + 1; // 1-indexed
  // GSA fiscal year: Oct = next year
  const fiscalYear = d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear();

  const rates = await fetchGSARates(city, state, fiscalYear);

  if (rates.length === 0) return null;

  // Find the best matching rate for this month
  // Prefer exact city match, fall back to first result
  const monthRates = rates.filter((r) => r.month === month);
  if (monthRates.length === 0) return null;

  // Return the first match (most specific city match from GSA)
  const rate = monthRates[0];
  return rate ? {
    lodgingRate: rate.lodgingRate,
    mieRate: rate.mieRate,
  } : null;
}

// Fetch all states for autocomplete
export async function fetchGSAStates(): Promise<string[]> {
  // US state abbreviations — hardcoded since GSA doesn't have a states endpoint
  return [
    'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL',
    'GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
    'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
    'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
    'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  ];
}
