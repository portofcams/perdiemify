/**
 * Discount Engine — Phase 2
 *
 * Handles:
 * - Community code validation scoring (upvote/downvote → success_rate)
 * - Code freshness & auto-expiration
 * - Scraper health monitoring
 * - Circuit breaker state for scrapers
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { discountCodes, scraperLogs } from '../db/schema';

// ─── Validation Scoring ──────────────────────────────────────────
// success_rate = upvotes / (upvotes + downvotes), clamped 0-1
// Codes with < 3 total votes get a neutral 0.50 score

export async function recalculateSuccessRates(): Promise<number> {
  const result = await db.execute(sql`
    UPDATE discount_codes
    SET
      success_rate = CASE
        WHEN (upvotes + downvotes) >= 3
          THEN ROUND(upvotes::decimal / (upvotes + downvotes), 2)
        ELSE 0.50
      END,
      is_validated = CASE
        WHEN (upvotes + downvotes) >= 3 AND (upvotes::decimal / (upvotes + downvotes)) >= 0.60
          THEN true
        ELSE false
      END,
      last_validated_at = CASE
        WHEN (upvotes + downvotes) >= 3 THEN NOW()
        ELSE last_validated_at
      END
    WHERE (expires_at IS NULL OR expires_at > NOW())
    RETURNING id
  `);

  return Array.isArray(result) ? result.length : 0;
}

// ─── Auto-expire stale codes ─────────────────────────────────────
// Codes with > 5 votes and < 20% success_rate → auto-expire

export async function expireStaleCode(): Promise<number> {
  const result = await db.execute(sql`
    UPDATE discount_codes
    SET expires_at = NOW()
    WHERE
      (expires_at IS NULL OR expires_at > NOW())
      AND (upvotes + downvotes) >= 5
      AND success_rate < 0.20
    RETURNING id
  `);

  const count = Array.isArray(result) ? result.length : 0;
  if (count > 0) {
    console.log(`[DiscountEngine] Auto-expired ${count} stale codes (success_rate < 20%)`);
  }
  return count;
}

// ─── Scraper Health Dashboard Data ───────────────────────────────

export interface ScraperHealthEntry {
  source: string;
  lastRun: string | null;
  lastStatus: string;
  totalRuns: number;
  avgCodesFound: number;
  avgDurationMs: number;
  errorRate: number;
  lastError: string | null;
  consecutiveFailures: number;
}

export async function getScraperHealth(): Promise<ScraperHealthEntry[]> {
  const results = await db.execute(sql`
    WITH latest_runs AS (
      SELECT DISTINCT ON (source)
        source,
        status AS last_status,
        run_at AS last_run,
        error_message AS last_error
      FROM scraper_logs
      ORDER BY source, run_at DESC
    ),
    stats AS (
      SELECT
        source,
        COUNT(*) AS total_runs,
        ROUND(AVG(codes_found), 1) AS avg_codes_found,
        ROUND(AVG(duration_ms), 0) AS avg_duration_ms,
        ROUND(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::decimal / NULLIF(COUNT(*), 0), 2) AS error_rate
      FROM scraper_logs
      GROUP BY source
    ),
    consecutive AS (
      SELECT
        source,
        COUNT(*) AS consecutive_failures
      FROM (
        SELECT source, status,
          ROW_NUMBER() OVER (PARTITION BY source ORDER BY run_at DESC) AS rn
        FROM scraper_logs
      ) ranked
      WHERE rn <= 10 AND status = 'error'
      GROUP BY source
    )
    SELECT
      lr.source,
      lr.last_run,
      lr.last_status,
      lr.last_error,
      s.total_runs,
      s.avg_codes_found,
      s.avg_duration_ms,
      s.error_rate,
      COALESCE(c.consecutive_failures, 0) AS consecutive_failures
    FROM latest_runs lr
    JOIN stats s ON s.source = lr.source
    LEFT JOIN consecutive c ON c.source = lr.source
    ORDER BY lr.source
  `);

  return (results as unknown as ScraperHealthEntry[]);
}

// ─── Circuit Breaker ─────────────────────────────────────────────
// If a scraper has 5+ consecutive failures, it's "tripped"
// API can check this before scheduling scraper jobs

const CIRCUIT_BREAKER_THRESHOLD = 5;

export async function getCircuitBreakerState(): Promise<Record<string, { tripped: boolean; failures: number }>> {
  const health = await getScraperHealth();
  const state: Record<string, { tripped: boolean; failures: number }> = {};

  for (const entry of health) {
    state[entry.source] = {
      tripped: entry.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD,
      failures: entry.consecutiveFailures,
    };
  }

  return state;
}

// ─── Deal Stats (for dashboard) ──────────────────────────────────

export interface DealStats {
  totalActive: number;
  totalValidated: number;
  byCategory: Record<string, number>;
  topProviders: { provider: string; count: number }[];
  recentlyAdded: number; // last 24h
}

export async function getDealStats(): Promise<DealStats> {
  const [activeResult, validatedResult, categoryResult, providerResult, recentResult] = await Promise.all([
    db.execute(sql`SELECT COUNT(*) AS count FROM discount_codes WHERE (expires_at IS NULL OR expires_at > NOW())`),
    db.execute(sql`SELECT COUNT(*) AS count FROM discount_codes WHERE is_validated = true AND (expires_at IS NULL OR expires_at > NOW())`),
    db.execute(sql`SELECT applicable_to, COUNT(*) AS count FROM discount_codes WHERE (expires_at IS NULL OR expires_at > NOW()) GROUP BY applicable_to`),
    db.execute(sql`SELECT provider, COUNT(*) AS count FROM discount_codes WHERE (expires_at IS NULL OR expires_at > NOW()) GROUP BY provider ORDER BY count DESC LIMIT 10`),
    db.execute(sql`SELECT COUNT(*) AS count FROM discount_codes WHERE created_at > NOW() - INTERVAL '24 hours'`),
  ]);

  const byCategory: Record<string, number> = {};
  if (Array.isArray(categoryResult)) {
    for (const row of categoryResult as unknown as { applicable_to: string; count: string }[]) {
      byCategory[row.applicable_to] = parseInt(row.count);
    }
  }

  const topProviders = Array.isArray(providerResult)
    ? (providerResult as unknown as { provider: string; count: string }[]).map(r => ({
        provider: r.provider,
        count: parseInt(r.count),
      }))
    : [];

  return {
    totalActive: parseInt((activeResult as unknown as { count: string }[])[0]?.count || '0'),
    totalValidated: parseInt((validatedResult as unknown as { count: string }[])[0]?.count || '0'),
    byCategory,
    topProviders,
    recentlyAdded: parseInt((recentResult as unknown as { count: string }[])[0]?.count || '0'),
  };
}
