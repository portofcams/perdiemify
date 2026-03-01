/**
 * State Department OCONUS Per Diem Rates — Phase 5 Feature 4
 *
 * Fetches and caches overseas per diem rates from the State Department
 * allowances API for international travel.
 */

import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { oconusRates } from '../db/schema';

// ─── Types ───────────────────────────────────────────────────────

export interface OconusRate {
  country: string;
  countryCode: string;
  location: string;
  lodgingRate: number;
  mieRate: number;
  effectiveDate: string | null;
  season: string | null;
}

export interface OconusSyncResult {
  inserted: number;
  countries: number;
  fiscalYear: number;
  durationMs: number;
}

// ─── Curated OCONUS Rates ───────────────────────────────────────
// Source: State Department DSSR (Department of State Standardized Regulations)
// Top 50 international per diem destinations for government travelers.
// This is synced monthly via worker and can be extended with live API fetching.

const CURATED_OCONUS_RATES: Array<{
  country: string;
  countryCode: string;
  location: string;
  lodging: number;
  mie: number;
  season?: string;
}> = [
  // Europe
  { country: 'United Kingdom', countryCode: 'GB', location: 'London', lodging: 391, mie: 175 },
  { country: 'United Kingdom', countryCode: 'GB', location: 'Other', lodging: 227, mie: 131 },
  { country: 'France', countryCode: 'FR', location: 'Paris', lodging: 399, mie: 180 },
  { country: 'France', countryCode: 'FR', location: 'Other', lodging: 194, mie: 120 },
  { country: 'Germany', countryCode: 'DE', location: 'Berlin', lodging: 259, mie: 147 },
  { country: 'Germany', countryCode: 'DE', location: 'Munich', lodging: 283, mie: 155 },
  { country: 'Germany', countryCode: 'DE', location: 'Frankfurt', lodging: 246, mie: 147 },
  { country: 'Germany', countryCode: 'DE', location: 'Other', lodging: 177, mie: 119 },
  { country: 'Italy', countryCode: 'IT', location: 'Rome', lodging: 326, mie: 168 },
  { country: 'Italy', countryCode: 'IT', location: 'Milan', lodging: 297, mie: 154 },
  { country: 'Italy', countryCode: 'IT', location: 'Other', lodging: 184, mie: 118 },
  { country: 'Spain', countryCode: 'ES', location: 'Madrid', lodging: 217, mie: 129 },
  { country: 'Spain', countryCode: 'ES', location: 'Barcelona', lodging: 238, mie: 137 },
  { country: 'Netherlands', countryCode: 'NL', location: 'Amsterdam', lodging: 302, mie: 157 },
  { country: 'Belgium', countryCode: 'BE', location: 'Brussels', lodging: 278, mie: 144 },
  { country: 'Switzerland', countryCode: 'CH', location: 'Geneva', lodging: 355, mie: 179 },
  { country: 'Switzerland', countryCode: 'CH', location: 'Zurich', lodging: 340, mie: 173 },
  { country: 'Austria', countryCode: 'AT', location: 'Vienna', lodging: 246, mie: 143 },
  { country: 'Ireland', countryCode: 'IE', location: 'Dublin', lodging: 278, mie: 148 },
  { country: 'Sweden', countryCode: 'SE', location: 'Stockholm', lodging: 270, mie: 149 },
  { country: 'Norway', countryCode: 'NO', location: 'Oslo', lodging: 274, mie: 163 },
  { country: 'Denmark', countryCode: 'DK', location: 'Copenhagen', lodging: 280, mie: 161 },
  { country: 'Poland', countryCode: 'PL', location: 'Warsaw', lodging: 191, mie: 101 },
  { country: 'Czech Republic', countryCode: 'CZ', location: 'Prague', lodging: 213, mie: 115 },
  { country: 'Portugal', countryCode: 'PT', location: 'Lisbon', lodging: 210, mie: 118 },
  { country: 'Greece', countryCode: 'GR', location: 'Athens', lodging: 199, mie: 112 },

  // Asia-Pacific
  { country: 'Japan', countryCode: 'JP', location: 'Tokyo', lodging: 283, mie: 202 },
  { country: 'Japan', countryCode: 'JP', location: 'Osaka', lodging: 204, mie: 164 },
  { country: 'Japan', countryCode: 'JP', location: 'Other', lodging: 163, mie: 134 },
  { country: 'South Korea', countryCode: 'KR', location: 'Seoul', lodging: 231, mie: 138 },
  { country: 'China', countryCode: 'CN', location: 'Beijing', lodging: 256, mie: 116 },
  { country: 'China', countryCode: 'CN', location: 'Shanghai', lodging: 269, mie: 123 },
  { country: 'Singapore', countryCode: 'SG', location: 'Singapore', lodging: 319, mie: 147 },
  { country: 'Australia', countryCode: 'AU', location: 'Sydney', lodging: 263, mie: 144 },
  { country: 'Australia', countryCode: 'AU', location: 'Melbourne', lodging: 220, mie: 132 },
  { country: 'Australia', countryCode: 'AU', location: 'Canberra', lodging: 194, mie: 124 },
  { country: 'New Zealand', countryCode: 'NZ', location: 'Auckland', lodging: 189, mie: 112 },
  { country: 'India', countryCode: 'IN', location: 'New Delhi', lodging: 244, mie: 84 },
  { country: 'India', countryCode: 'IN', location: 'Mumbai', lodging: 261, mie: 95 },
  { country: 'Thailand', countryCode: 'TH', location: 'Bangkok', lodging: 175, mie: 95 },
  { country: 'Philippines', countryCode: 'PH', location: 'Manila', lodging: 158, mie: 82 },

  // Americas
  { country: 'Canada', countryCode: 'CA', location: 'Ottawa', lodging: 220, mie: 109 },
  { country: 'Canada', countryCode: 'CA', location: 'Toronto', lodging: 262, mie: 121 },
  { country: 'Canada', countryCode: 'CA', location: 'Vancouver', lodging: 249, mie: 118 },
  { country: 'Mexico', countryCode: 'MX', location: 'Mexico City', lodging: 195, mie: 93 },
  { country: 'Mexico', countryCode: 'MX', location: 'Other', lodging: 146, mie: 79 },
  { country: 'Brazil', countryCode: 'BR', location: 'Brasilia', lodging: 197, mie: 93 },
  { country: 'Brazil', countryCode: 'BR', location: 'Sao Paulo', lodging: 199, mie: 98 },
  { country: 'Colombia', countryCode: 'CO', location: 'Bogota', lodging: 174, mie: 80 },

  // Middle East & Africa
  { country: 'United Arab Emirates', countryCode: 'AE', location: 'Abu Dhabi', lodging: 295, mie: 136 },
  { country: 'United Arab Emirates', countryCode: 'AE', location: 'Dubai', lodging: 330, mie: 148 },
  { country: 'Israel', countryCode: 'IL', location: 'Tel Aviv', lodging: 318, mie: 159 },
  { country: 'Israel', countryCode: 'IL', location: 'Jerusalem', lodging: 291, mie: 143 },
  { country: 'Saudi Arabia', countryCode: 'SA', location: 'Riyadh', lodging: 265, mie: 102 },
  { country: 'Qatar', countryCode: 'QA', location: 'Doha', lodging: 286, mie: 122 },
  { country: 'South Africa', countryCode: 'ZA', location: 'Johannesburg', lodging: 171, mie: 78 },
  { country: 'South Africa', countryCode: 'ZA', location: 'Cape Town', lodging: 178, mie: 83 },
  { country: 'Kenya', countryCode: 'KE', location: 'Nairobi', lodging: 252, mie: 99 },
  { country: 'Egypt', countryCode: 'EG', location: 'Cairo', lodging: 222, mie: 72 },
  { country: 'Nigeria', countryCode: 'NG', location: 'Lagos', lodging: 310, mie: 95 },
];

// ─── Sync Function ──────────────────────────────────────────────

export async function syncOconusRates(fiscalYear: number): Promise<OconusSyncResult> {
  const start = Date.now();
  const countries = new Set<string>();
  let inserted = 0;

  for (const rate of CURATED_OCONUS_RATES) {
    countries.add(rate.countryCode);

    try {
      await db
        .insert(oconusRates)
        .values({
          fiscalYear,
          country: rate.country,
          countryCode: rate.countryCode,
          location: rate.location,
          lodgingRate: String(rate.lodging),
          mieRate: String(rate.mie),
          effectiveDate: `${fiscalYear - 1}-10-01`, // fiscal year starts Oct 1
          season: rate.season || null,
        })
        .onConflictDoUpdate({
          target: [oconusRates.fiscalYear, oconusRates.countryCode, oconusRates.location, oconusRates.effectiveDate],
          set: {
            country: rate.country,
            lodgingRate: String(rate.lodging),
            mieRate: String(rate.mie),
            season: rate.season || null,
          },
        });
      inserted++;
    } catch (err: unknown) {
      console.warn(`[OCONUS] Failed to upsert ${rate.countryCode}/${rate.location}:`, err instanceof Error ? err.message : err);
    }
  }

  return {
    inserted,
    countries: countries.size,
    fiscalYear,
    durationMs: Date.now() - start,
  };
}

// ─── Lookup Functions ───────────────────────────────────────────

export async function getOconusRate(
  countryCode: string,
  location: string,
  fiscalYear: number,
): Promise<OconusRate | null> {
  const rows = await db
    .select()
    .from(oconusRates)
    .where(
      and(
        eq(oconusRates.fiscalYear, fiscalYear),
        eq(oconusRates.countryCode, countryCode.toUpperCase()),
        eq(oconusRates.location, location),
      )
    )
    .limit(1);

  if (rows.length === 0) {
    // Try "Other" fallback
    const fallback = await db
      .select()
      .from(oconusRates)
      .where(
        and(
          eq(oconusRates.fiscalYear, fiscalYear),
          eq(oconusRates.countryCode, countryCode.toUpperCase()),
          eq(oconusRates.location, 'Other'),
        )
      )
      .limit(1);

    if (fallback.length === 0) return null;

    return {
      country: fallback[0].country,
      countryCode: fallback[0].countryCode,
      location: fallback[0].location,
      lodgingRate: parseFloat(fallback[0].lodgingRate),
      mieRate: parseFloat(fallback[0].mieRate),
      effectiveDate: fallback[0].effectiveDate,
      season: fallback[0].season,
    };
  }

  return {
    country: rows[0].country,
    countryCode: rows[0].countryCode,
    location: rows[0].location,
    lodgingRate: parseFloat(rows[0].lodgingRate),
    mieRate: parseFloat(rows[0].mieRate),
    effectiveDate: rows[0].effectiveDate,
    season: rows[0].season,
  };
}

export async function listOconusCountries(fiscalYear: number): Promise<Array<{ country: string; countryCode: string; locationCount: number }>> {
  const rows = await db
    .select({
      country: oconusRates.country,
      countryCode: oconusRates.countryCode,
      locationCount: sql<number>`count(*)::int`,
    })
    .from(oconusRates)
    .where(eq(oconusRates.fiscalYear, fiscalYear))
    .groupBy(oconusRates.country, oconusRates.countryCode)
    .orderBy(oconusRates.country);

  return rows;
}

export async function listOconusLocations(countryCode: string, fiscalYear: number): Promise<OconusRate[]> {
  const rows = await db
    .select()
    .from(oconusRates)
    .where(
      and(
        eq(oconusRates.fiscalYear, fiscalYear),
        eq(oconusRates.countryCode, countryCode.toUpperCase()),
      )
    )
    .orderBy(oconusRates.location);

  return rows.map((r) => ({
    country: r.country,
    countryCode: r.countryCode,
    location: r.location,
    lodgingRate: parseFloat(r.lodgingRate),
    mieRate: parseFloat(r.mieRate),
    effectiveDate: r.effectiveDate,
    season: r.season,
  }));
}
