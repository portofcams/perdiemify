import { Router, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { sendDealAlerts } from '../services/deal-alerts';

export const dealsRouter = Router();

/**
 * GET /api/deals — Get active discount codes
 * Query params: provider, type (hotel/flight/car/all)
 */
dealsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const provider = req.query.provider as string | undefined;
    const applicableTo = req.query.type as string | undefined;

    let query = sql`
      SELECT id, code, provider, type, value, description, source, applicable_to, expires_at, is_validated, success_rate, upvotes, downvotes, created_at
      FROM discount_codes
      WHERE (expires_at IS NULL OR expires_at > NOW())
    `;

    if (provider) {
      query = sql`${query} AND LOWER(provider) LIKE LOWER(${`%${provider}%`})`;
    }
    if (applicableTo && applicableTo !== 'all') {
      query = sql`${query} AND (applicable_to = ${applicableTo} OR applicable_to = 'all')`;
    }

    query = sql`${query} ORDER BY upvotes DESC, created_at DESC LIMIT 50`;

    const codes = await db.execute(query);

    return res.json({ success: true, data: codes });
  } catch (err) {
    console.error('Get deals error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch deals' });
  }
});

/**
 * POST /api/deals/:id/vote — Upvote or downvote a code
 */
dealsRouter.post('/:id/vote', async (req: Request, res: Response) => {
  try {
    const { vote } = req.body; // 'up' or 'down'
    const id = req.params.id;

    if (vote === 'up') {
      await db.execute(sql`UPDATE discount_codes SET upvotes = upvotes + 1 WHERE id = ${id}::uuid`);
    } else if (vote === 'down') {
      await db.execute(sql`UPDATE discount_codes SET downvotes = downvotes + 1 WHERE id = ${id}::uuid`);
    } else {
      return res.status(400).json({ success: false, error: 'vote must be "up" or "down"' });
    }

    return res.json({ success: true, message: 'Vote recorded' });
  } catch (err) {
    console.error('Vote error:', err);
    return res.status(500).json({ success: false, error: 'Failed to record vote' });
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

    const sent = await sendDealAlerts(deals);
    return res.json({ success: true, data: { sent, totalDeals: deals.length } });
  } catch (err) {
    console.error('Deal notify error:', err);
    return res.status(500).json({ success: false, error: 'Failed to send notifications' });
  }
});
