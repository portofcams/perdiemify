import { Router, Request, Response } from 'express';
import { eq, sql, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { users, trips, bookings, meals, loyaltyAccounts } from '../db/schema';

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

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
 * GET /api/analytics/overview — Full dashboard analytics
 */
analyticsRouter.get('/overview', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.json({
        success: true,
        data: {
          savingsByTrip: [],
          monthlySavings: [],
          categoryBreakdown: [],
          loyaltyValue: 0,
          totalSavings: 0,
          tripCount: 0,
        },
      });
    }

    // Savings by trip (for bar chart)
    const tripSavings = await db
      .select({
        name: trips.name,
        destination: trips.destination,
        startDate: trips.startDate,
        totalSavings: trips.totalSavings,
        lodgingRate: trips.lodgingRate,
        mieRate: trips.mieRate,
      })
      .from(trips)
      .where(eq(trips.userId, userId))
      .orderBy(trips.startDate);

    // Calculate per-trip allowance and build chart data
    const savingsByTrip = tripSavings.map((t) => {
      const start = new Date(t.startDate);
      const end = new Date(t.startDate); // use startDate as label
      const savings = Number(t.totalSavings || 0);
      return {
        name: t.name.length > 20 ? t.name.slice(0, 18) + '...' : t.name,
        destination: t.destination,
        savings,
        date: t.startDate,
      };
    });

    // Monthly savings aggregation (for line chart)
    const monthlyRaw = await db
      .select({
        month: sql<string>`to_char(${trips.startDate}::date, 'YYYY-MM')`,
        total: sql<string>`coalesce(sum(${trips.totalSavings}), 0)::numeric(10,2)`,
        count: sql<number>`count(*)::int`,
      })
      .from(trips)
      .where(eq(trips.userId, userId))
      .groupBy(sql`to_char(${trips.startDate}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${trips.startDate}::date, 'YYYY-MM')`);

    // Cumulative savings for line chart
    let cumulative = 0;
    const monthlySavings = monthlyRaw.map((m) => {
      cumulative += Number(m.total);
      return {
        month: m.month,
        savings: Number(m.total),
        cumulative: Math.round(cumulative * 100) / 100,
        trips: m.count,
      };
    });

    // Booking category breakdown (for donut chart)
    const categoryRaw = await db
      .select({
        type: bookings.type,
        count: sql<number>`count(*)::int`,
        totalSpent: sql<string>`coalesce(sum(${bookings.price}), 0)::numeric(10,2)`,
        totalDelta: sql<string>`coalesce(sum(${bookings.perDiemDelta}), 0)::numeric(10,2)`,
      })
      .from(bookings)
      .where(eq(bookings.userId, userId))
      .groupBy(bookings.type);

    const categoryBreakdown = categoryRaw.map((c) => ({
      type: c.type,
      count: c.count,
      totalSpent: Number(c.totalSpent),
      savings: Number(c.totalDelta),
    }));

    // Loyalty portfolio value
    const [loyaltySum] = await db
      .select({
        totalPoints: sql<number>`coalesce(sum(${loyaltyAccounts.pointsBalance}), 0)::int`,
      })
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.userId, userId));

    // Meal spending total
    const [mealSum] = await db
      .select({
        totalSpent: sql<string>`coalesce(sum(${meals.amount}), 0)::numeric(10,2)`,
      })
      .from(meals)
      .where(eq(meals.userId, userId));

    // Trip totals
    const [tripTotals] = await db
      .select({
        totalSavings: sql<string>`coalesce(sum(${trips.totalSavings}), 0)::numeric(10,2)`,
        tripCount: sql<number>`count(*)::int`,
      })
      .from(trips)
      .where(eq(trips.userId, userId));

    return res.json({
      success: true,
      data: {
        savingsByTrip,
        monthlySavings,
        categoryBreakdown,
        loyaltyPoints: loyaltySum?.totalPoints ?? 0,
        mealSpending: Number(mealSum?.totalSpent ?? 0),
        totalSavings: Number(tripTotals?.totalSavings ?? 0),
        tripCount: tripTotals?.tripCount ?? 0,
      },
    });
  } catch (err) {
    console.error('Analytics error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});
