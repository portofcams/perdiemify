import { Router, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { dealAlertsQueue } from '../queue/queues';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { dealSubmitSchema, dealVoteSchema } from '@perdiemify/shared';
import {
  recalculateSuccessRates,
  expireStaleCode,
  getScraperHealth,
  getCircuitBreakerState,
  getDealStats,
} from '../services/discount-engine';

export const dealsRouter = Router();

/**
 * GET /api/deals — Get active discount codes
 * Query params:
 *   provider  — filter by provider name (partial match)
 *   type      — filter by applicable_to (hotel/flight/car/all)
 *   search    — full-text search on code + description + provider
 *   sort      — upvotes (default), newest, success_rate
 *   verified  — "true" to only show validated codes
 *   page      — page number (1-indexed, default 1)
 *   limit     — items per page (default 30, max 100)
 */
dealsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const provider = req.query.provider as string | undefined;
    const applicableTo = req.query.type as string | undefined;
    const search = req.query.search as string | undefined;
    const sort = (req.query.sort as string) || 'upvotes';
    const verifiedOnly = req.query.verified === 'true';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30));
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    let whereClause = sql`WHERE (expires_at IS NULL OR expires_at > NOW())`;

    if (provider) {
      whereClause = sql`${whereClause} AND LOWER(provider) LIKE LOWER(${`%${provider}%`})`;
    }
    if (applicableTo && applicableTo !== 'all') {
      whereClause = sql`${whereClause} AND (applicable_to = ${applicableTo} OR applicable_to = 'all')`;
    }
    if (search) {
      const searchTerm = `%${search}%`;
      whereClause = sql`${whereClause} AND (
        LOWER(code) LIKE LOWER(${searchTerm})
        OR LOWER(description) LIKE LOWER(${searchTerm})
        OR LOWER(provider) LIKE LOWER(${searchTerm})
      )`;
    }
    if (verifiedOnly) {
      whereClause = sql`${whereClause} AND is_validated = true`;
    }

    // Build ORDER BY
    let orderClause: ReturnType<typeof sql>;
    switch (sort) {
      case 'newest':
        orderClause = sql`ORDER BY created_at DESC`;
        break;
      case 'success_rate':
        orderClause = sql`ORDER BY success_rate DESC, upvotes DESC`;
        break;
      case 'upvotes':
      default:
        orderClause = sql`ORDER BY upvotes DESC, created_at DESC`;
        break;
    }

    // Count total for pagination
    const countQuery = sql`SELECT COUNT(*) AS total FROM discount_codes ${whereClause}`;
    const countResult = await db.execute(countQuery);
    const total = parseInt((countResult as unknown as { total: string }[])[0]?.total || '0');

    // Fetch page
    const query = sql`
      SELECT id, code, provider, type, value, description, source, source_url, applicable_to,
             expires_at, is_validated, last_validated_at, success_rate, upvotes, downvotes,
             submitted_by, created_at
      FROM discount_codes
      ${whereClause}
      ${orderClause}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const codes = await db.execute(query);

    return res.json({
      success: true,
      data: codes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Get deals error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch deals' });
  }
});

/**
 * POST /api/deals/submit — Community code submission (requires auth)
 * Body: { code, provider, type, value, description, applicableTo }
 */
dealsRouter.post('/submit', requireAuth, validateBody(dealSubmitSchema), async (req: Request, res: Response) => {
  try {
    const { code, provider, type, value, description, applicableTo } = req.body;
    const clerkId = req.auth!.userId;

    const cleanCode = code.trim().toUpperCase();
    const codeType = type || 'promo';
    const category = applicableTo || 'all';

    // Look up the user's internal UUID from clerk_id
    const userResult = await db.execute(
      sql`SELECT id, subscription_tier FROM users WHERE clerk_id = ${clerkId}`
    );
    const user = (userResult as unknown as { id: string; subscription_tier: string }[])[0];

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check for duplicate code+provider combo
    const existing = await db.execute(sql`
      SELECT id FROM discount_codes
      WHERE LOWER(code) = LOWER(${cleanCode}) AND LOWER(provider) = LOWER(${provider.trim()})
      AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `);

    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(409).json({ success: false, error: 'This code already exists for this provider' });
    }

    // Insert the code
    const insertResult = await db.execute(sql`
      INSERT INTO discount_codes (
        id, code, provider, type, value, description, source, source_url,
        applicable_to, expires_at, is_validated, success_rate, upvotes, downvotes,
        submitted_by, created_at
      ) VALUES (
        gen_random_uuid(), ${cleanCode}, ${provider.trim()}, ${codeType}, ${value || null},
        ${description?.trim() || null}, 'community', null,
        ${category}, null, false, 0.50, 1, 0,
        ${user.id}::uuid, NOW()
      )
      RETURNING id, code, provider, type, value, description, applicable_to, created_at
    `);

    return res.status(201).json({ success: true, data: (insertResult as unknown[])[0] });
  } catch (err) {
    console.error('Submit deal error:', err);
    return res.status(500).json({ success: false, error: 'Failed to submit deal' });
  }
});

/**
 * POST /api/deals/:id/vote — Upvote or downvote a code
 */
dealsRouter.post('/:id/vote', validateBody(dealVoteSchema), async (req: Request, res: Response) => {
  try {
    const { vote } = req.body;
    const id = req.params.id;

    if (vote === 'up') {
      await db.execute(sql`UPDATE discount_codes SET upvotes = upvotes + 1 WHERE id = ${id}::uuid`);
    } else {
      await db.execute(sql`UPDATE discount_codes SET downvotes = downvotes + 1 WHERE id = ${id}::uuid`);
    }

    return res.json({ success: true, message: 'Vote recorded' });
  } catch (err) {
    console.error('Vote error:', err);
    return res.status(500).json({ success: false, error: 'Failed to record vote' });
  }
});

/**
 * GET /api/deals/stats — Deal statistics
 */
dealsRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getDealStats();
    return res.json({ success: true, data: stats });
  } catch (err) {
    console.error('Deal stats error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/deals/scraper-health — Scraper health dashboard data
 */
dealsRouter.get('/scraper-health', async (_req: Request, res: Response) => {
  try {
    const [health, circuitBreakers] = await Promise.all([
      getScraperHealth(),
      getCircuitBreakerState(),
    ]);

    return res.json({ success: true, data: { scrapers: health, circuitBreakers } });
  } catch (err) {
    console.error('Scraper health error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch scraper health' });
  }
});

/**
 * POST /api/deals/validate — Recalculate success rates & expire stale codes
 * Internal endpoint, run by worker/cron
 */
dealsRouter.post('/validate', async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers['x-internal-key'];
    if (apiKey !== (process.env.INTERNAL_API_KEY || 'perdiemify-internal')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const [updated, expired] = await Promise.all([
      recalculateSuccessRates(),
      expireStaleCode(),
    ]);

    return res.json({ success: true, data: { successRatesUpdated: updated, codesExpired: expired } });
  } catch (err) {
    console.error('Validate deals error:', err);
    return res.status(500).json({ success: false, error: 'Failed to validate deals' });
  }
});

/**
 * POST /api/deals/notify — Internal: trigger deal alert emails for new codes
 * Called by the scraper after finding new deals.
 * Protected by an internal API key.
 */
dealsRouter.post('/notify', async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers['x-internal-key'];
    if (apiKey !== (process.env.INTERNAL_API_KEY || 'perdiemify-internal')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { deals } = req.body;
    if (!deals || !Array.isArray(deals) || deals.length === 0) {
      return res.json({ success: true, data: { sent: 0 } });
    }

    // Enqueue deal alerts via BullMQ (processed by worker)
    await dealAlertsQueue.add('deal-alert', { deals });
    return res.json({ success: true, data: { queued: true, totalDeals: deals.length } });
  } catch (err) {
    console.error('Deal notify error:', err);
    return res.status(500).json({ success: false, error: 'Failed to send notifications' });
  }
});
