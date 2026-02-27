import { Router, Request, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { users, loyaltyAccounts, loyaltyValuations } from '../db/schema';

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
loyaltyRouter.post('/accounts', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User not found in database' });
    }

    const { programName, programCategory, accountNumber, pointsBalance, statusLevel } = req.body;

    if (!programName || !programCategory) {
      return res.status(400).json({
        success: false,
        error: 'programName and programCategory are required',
      });
    }

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
