import { Router, Request, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { loyaltyAccountSchema, loyaltyRecommendSchema } from '@perdiemify/shared';
import { db } from '../db';
import { users, loyaltyAccounts, loyaltyValuations } from '../db/schema';
import {
  recommendCreditCard,
  estimatePointsEarned,
  getStatusProgress,
  getProgramDetails,
  syncLoyaltyValuations,
  PROGRAM_VALUATIONS,
} from '../services/loyalty-tracker';

export const loyaltyRouter = Router();

/** Helper: look up internal user ID from Clerk ID */
async function getUserId(clerkId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return user?.id ?? null;
}

/**
 * GET /api/loyalty/accounts — List user's loyalty accounts
 */
loyaltyRouter.get('/accounts', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.json({ success: true, data: [] });
    }

    const accounts = await db
      .select()
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.userId, userId));

    // Enrich with valuations
    const valuations = await db.select().from(loyaltyValuations);
    const valMap = new Map(valuations.map((v) => [v.programName, v]));

    const enriched = accounts.map((a) => {
      const val = valMap.get(a.programName);
      const pointValue = val ? Number(val.pointValueCents) : Number(a.pointValueCents) || 0;
      return {
        ...a,
        estimatedValueUsd: Math.round(a.pointsBalance * pointValue) / 100,
        marketPointValue: val?.pointValueCents ?? null,
        bestRedemptionType: val?.bestRedemptionType ?? null,
      };
    });

    return res.json({ success: true, data: enriched });
  } catch (err) {
    console.error('List loyalty accounts error:', err);
    return res.status(500).json({ success: false, error: 'Failed to list loyalty accounts' });
  }
});

/**
 * POST /api/loyalty/accounts — Add a loyalty account
 */
loyaltyRouter.post('/accounts', requireAuth, validateBody(loyaltyAccountSchema), async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User not found in database' });
    }

    const { programName, programCategory, accountNumber, pointsBalance, statusLevel } = req.body;

    const [account] = await db
      .insert(loyaltyAccounts)
      .values({
        userId,
        programName,
        programCategory,
        accountNumber: accountNumber || null,
        pointsBalance: pointsBalance || 0,
        statusLevel: statusLevel || null,
      })
      .onConflictDoUpdate({
        target: [loyaltyAccounts.userId, loyaltyAccounts.programName],
        set: {
          pointsBalance: pointsBalance || 0,
          statusLevel: statusLevel || null,
          accountNumber: accountNumber || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return res.status(201).json({ success: true, data: account });
  } catch (err) {
    console.error('Add loyalty account error:', err);
    return res.status(500).json({ success: false, error: 'Failed to add loyalty account' });
  }
});

/**
 * PATCH /api/loyalty/accounts/:id — Update a loyalty account (points, status)
 */
loyaltyRouter.patch('/accounts/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    // Verify ownership
    const [existing] = await db
      .select({ userId: loyaltyAccounts.userId })
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.id, req.params.id as string))
      .limit(1);

    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    const { pointsBalance, statusLevel, statusProgress, accountNumber } = req.body;

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (pointsBalance !== undefined) updateFields.pointsBalance = pointsBalance;
    if (statusLevel !== undefined) updateFields.statusLevel = statusLevel;
    if (statusProgress !== undefined) updateFields.statusProgress = statusProgress;
    if (accountNumber !== undefined) updateFields.accountNumber = accountNumber;

    const [updated] = await db
      .update(loyaltyAccounts)
      .set(updateFields)
      .where(eq(loyaltyAccounts.id, req.params.id as string))
      .returning();

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update loyalty account error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update loyalty account' });
  }
});

/**
 * DELETE /api/loyalty/accounts/:id — Remove a loyalty account
 */
loyaltyRouter.delete('/accounts/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    const [existing] = await db
      .select({ userId: loyaltyAccounts.userId })
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.id, req.params.id as string))
      .limit(1);

    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    await db.delete(loyaltyAccounts).where(eq(loyaltyAccounts.id, req.params.id as string));
    return res.json({ success: true, message: 'Account removed' });
  } catch (err) {
    console.error('Delete loyalty account error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete account' });
  }
});

/**
 * GET /api/loyalty/valuations — Get point valuations for all programs
 */
loyaltyRouter.get('/valuations', async (_req: Request, res: Response) => {
  try {
    const valuations = await db.select().from(loyaltyValuations);
    return res.json({ success: true, data: valuations });
  } catch (err) {
    console.error('Get valuations error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch valuations' });
  }
});

/**
 * GET /api/loyalty/summary — Total portfolio value across all programs
 */
loyaltyRouter.get('/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.json({
        success: true,
        data: { totalPoints: 0, estimatedValueUsd: 0, programCount: 0 },
      });
    }

    const [summary] = await db
      .select({
        totalPoints: sql<number>`coalesce(sum(${loyaltyAccounts.pointsBalance}), 0)::int`,
        programCount: sql<number>`count(*)::int`,
      })
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.userId, userId));

    // Calculate estimated value using valuations table
    const accounts = await db
      .select({
        programName: loyaltyAccounts.programName,
        points: loyaltyAccounts.pointsBalance,
        customValue: loyaltyAccounts.pointValueCents,
      })
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.userId, userId));

    const valuations = await db.select().from(loyaltyValuations);
    const valMap = new Map(valuations.map((v) => [v.programName, Number(v.pointValueCents)]));

    let totalValueCents = 0;
    for (const acct of accounts) {
      const cpv = valMap.get(acct.programName) ?? Number(acct.customValue) ?? 1;
      totalValueCents += acct.points * cpv;
    }

    return res.json({
      success: true,
      data: {
        totalPoints: summary?.totalPoints ?? 0,
        estimatedValueUsd: Math.round(totalValueCents) / 100,
        programCount: summary?.programCount ?? 0,
      },
    });
  } catch (err) {
    console.error('Get loyalty summary error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch loyalty summary' });
  }
});

/**
 * POST /api/loyalty/recommend — Credit card recommendation for a booking
 * Body: { bookingType: 'hotel'|'flight'|'car', provider: string, amountUsd: number }
 */
loyaltyRouter.post('/recommend', validateBody(loyaltyRecommendSchema), async (req: Request, res: Response) => {
  try {
    const { bookingType, provider, amountUsd } = req.body;

    const recommendations = recommendCreditCard(bookingType, provider, amountUsd);
    return res.json({ success: true, data: recommendations });
  } catch (err) {
    console.error('Credit card recommendation error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate recommendations' });
  }
});

/**
 * GET /api/loyalty/estimate — Estimate points earned for a booking
 * Query: ?program=Marriott+Bonvoy&amount=150&status=Gold
 */
loyaltyRouter.get('/estimate', async (req: Request, res: Response) => {
  try {
    const program = req.query.program as string;
    const amount = parseFloat(req.query.amount as string);
    const status = req.query.status as string | undefined;

    if (!program || isNaN(amount)) {
      return res.status(400).json({ success: false, error: 'program and amount are required' });
    }

    const estimate = estimatePointsEarned(program, amount, status);
    return res.json({
      success: true,
      data: {
        programName: program,
        amountUsd: amount,
        statusLevel: status || null,
        pointsEarned: estimate.points,
        estimatedValueCents: estimate.valueCents,
        estimatedValueUsd: Math.round(estimate.valueCents) / 100,
      },
    });
  } catch (err) {
    console.error('Estimate points error:', err);
    return res.status(500).json({ success: false, error: 'Failed to estimate points' });
  }
});

/**
 * GET /api/loyalty/programs/:name — Get full program details (tiers, partners, etc.)
 */
loyaltyRouter.get('/programs/:name', async (req: Request, res: Response) => {
  try {
    const name = decodeURIComponent(req.params.name as string);
    const program = getProgramDetails(name);

    if (!program) {
      return res.status(404).json({ success: false, error: 'Program not found' });
    }

    return res.json({ success: true, data: program });
  } catch (err) {
    console.error('Get program details error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch program details' });
  }
});

/**
 * GET /api/loyalty/programs — List all program details
 */
loyaltyRouter.get('/programs', async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: PROGRAM_VALUATIONS });
  } catch (err) {
    console.error('List programs error:', err);
    return res.status(500).json({ success: false, error: 'Failed to list programs' });
  }
});

/**
 * GET /api/loyalty/status/:id — Get elite status progress for an account
 */
loyaltyRouter.get('/status/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const [account] = await db
      .select()
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.id, req.params.id as string))
      .limit(1);

    if (!account || account.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    const progress = getStatusProgress(
      account.programName,
      account.statusLevel,
      account.statusProgress
    );

    return res.json({ success: true, data: progress });
  } catch (err) {
    console.error('Get status progress error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch status progress' });
  }
});

/**
 * POST /api/loyalty/sync-valuations — Internal: refresh valuations data
 */
loyaltyRouter.post('/sync-valuations', async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers['x-internal-key'];
    if (apiKey !== (process.env.INTERNAL_API_KEY || 'perdiemify-internal')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const result = await syncLoyaltyValuations();
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('Sync valuations error:', err);
    return res.status(500).json({ success: false, error: 'Failed to sync valuations' });
  }
});
