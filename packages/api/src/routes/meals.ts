import { Router, Request, Response } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { mealSchema } from '@perdiemify/shared';
import { db } from '../db';
import { users, meals, trips } from '../db/schema';

export const mealsRouter = Router();

mealsRouter.use(requireAuth);

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
 * GET /api/meals?tripId=xxx — List meals for a trip (or all meals if no tripId)
 */
mealsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.json({ success: true, data: [] });
    }

    const tripId = req.query.tripId as string | undefined;

    const conditions = tripId
      ? and(eq(meals.userId, userId), eq(meals.tripId, tripId))
      : eq(meals.userId, userId);

    const userMeals = await db
      .select()
      .from(meals)
      .where(conditions)
      .orderBy(meals.date);

    return res.json({ success: true, data: userMeals });
  } catch (err) {
    console.error('List meals error:', err);
    return res.status(500).json({ success: false, error: 'Failed to list meals' });
  }
});

/**
 * GET /api/meals/summary?tripId=xxx — M&IE spending summary for a trip
 */
mealsRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.json({ success: true, data: { totalSpent: 0, mealCount: 0, dailyBreakdown: [] } });
    }

    const tripId = req.query.tripId as string | undefined;
    if (!tripId) {
      return res.status(400).json({ success: false, error: 'tripId is required' });
    }

    // Get trip M&IE rate
    const [trip] = await db
      .select({ mieRate: trips.mieRate, startDate: trips.startDate, endDate: trips.endDate })
      .from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
      .limit(1);

    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    // Get meal totals grouped by date
    const dailyTotals = await db
      .select({
        date: meals.date,
        totalSpent: sql<string>`sum(${meals.amount})::numeric(10,2)`,
        mealCount: sql<number>`count(*)::int`,
      })
      .from(meals)
      .where(and(eq(meals.userId, userId), eq(meals.tripId, tripId)))
      .groupBy(meals.date)
      .orderBy(meals.date);

    const totalSpent = dailyTotals.reduce((s, d) => s + Number(d.totalSpent), 0);
    const mealCount = dailyTotals.reduce((s, d) => s + d.mealCount, 0);
    const mieRate = Number(trip.mieRate);

    // Calculate trip days
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const tripDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000)) + 1;
    const totalAllowance = tripDays * mieRate;

    return res.json({
      success: true,
      data: {
        totalSpent: Math.round(totalSpent * 100) / 100,
        totalAllowance: Math.round(totalAllowance * 100) / 100,
        remaining: Math.round((totalAllowance - totalSpent) * 100) / 100,
        mealCount,
        tripDays,
        mieRate,
        dailyBreakdown: dailyTotals.map(d => ({
          date: d.date,
          spent: Number(d.totalSpent),
          allowance: mieRate,
          remaining: mieRate - Number(d.totalSpent),
          mealCount: d.mealCount,
        })),
      },
    });
  } catch (err) {
    console.error('Meal summary error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get meal summary' });
  }
});

/**
 * POST /api/meals — Log a meal expense
 */
mealsRouter.post('/', validateBody(mealSchema), async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User not found' });
    }

    const { tripId, date, mealType, amount, vendor, notes } = req.body;

    // Verify trip ownership
    const [trip] = await db
      .select({ userId: trips.userId })
      .from(trips)
      .where(eq(trips.id, tripId))
      .limit(1);

    if (!trip || trip.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    const [meal] = await db
      .insert(meals)
      .values({
        userId,
        tripId,
        date,
        mealType,
        amount: String(amount),
        vendor: vendor || null,
        notes: notes || null,
      })
      .returning();

    return res.status(201).json({ success: true, data: meal });
  } catch (err) {
    console.error('Log meal error:', err);
    return res.status(500).json({ success: false, error: 'Failed to log meal' });
  }
});

/**
 * PATCH /api/meals/:id — Update a meal entry
 */
mealsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'Meal not found' });
    }

    const [existing] = await db
      .select({ userId: meals.userId })
      .from(meals)
      .where(eq(meals.id, req.params.id as string))
      .limit(1);

    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Meal not found' });
    }

    const { mealType, amount, vendor, notes, date } = req.body;
    const updateFields: Record<string, unknown> = {};
    if (mealType !== undefined) updateFields.mealType = mealType;
    if (amount !== undefined) updateFields.amount = String(amount);
    if (vendor !== undefined) updateFields.vendor = vendor;
    if (notes !== undefined) updateFields.notes = notes;
    if (date !== undefined) updateFields.date = date;

    const [updated] = await db
      .update(meals)
      .set(updateFields)
      .where(eq(meals.id, req.params.id as string))
      .returning();

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update meal error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update meal' });
  }
});

/**
 * DELETE /api/meals/:id — Delete a meal entry
 */
mealsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'Meal not found' });
    }

    const [existing] = await db
      .select({ userId: meals.userId })
      .from(meals)
      .where(eq(meals.id, req.params.id as string))
      .limit(1);

    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Meal not found' });
    }

    await db.delete(meals).where(eq(meals.id, req.params.id as string));
    return res.json({ success: true, message: 'Meal entry deleted' });
  } catch (err) {
    console.error('Delete meal error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete meal' });
  }
});
