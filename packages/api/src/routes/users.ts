import { Router, Request, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { users, trips, bookings } from '../db/schema';

export const usersRouter = Router();

// All user routes require authentication
usersRouter.use(requireAuth);

/**
 * GET /api/users/me — Get current user's profile
 */
usersRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const clerkId = req.auth!.userId;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!user) {
      // User exists in Clerk but not yet in our DB — return defaults
      return res.json({
        success: true,
        data: {
          clerkId,
          email: req.auth!.email,
          name: req.auth!.name,
          subscriptionTier: 'free',
          perDiemSource: 'gsa',
          customLodgingRate: null,
          customMieRate: null,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        clerkId: user.clerkId,
        email: user.email,
        name: user.name,
        subscriptionTier: user.subscriptionTier,
        perDiemSource: user.perDiemSource,
        customLodgingRate: user.customLodgingRate,
        customMieRate: user.customMieRate,
      },
    });
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch user profile' });
  }
});

/**
 * PATCH /api/users/me — Update user profile
 */
usersRouter.patch('/me', async (req: Request, res: Response) => {
  try {
    const clerkId = req.auth!.userId;
    const { name, perDiemSource, customLodgingRate, customMieRate } = req.body;

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateFields.name = name;
    if (perDiemSource !== undefined) updateFields.perDiemSource = perDiemSource;
    if (customLodgingRate !== undefined) updateFields.customLodgingRate = String(customLodgingRate);
    if (customMieRate !== undefined) updateFields.customMieRate = String(customMieRate);

    const result = await db
      .update(users)
      .set(updateFields)
      .where(eq(users.clerkId, clerkId));

    return res.json({
      success: true,
      message: 'Profile updated',
    });
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

/**
 * GET /api/users/me/stats — Get user's dashboard stats
 */
usersRouter.get('/me/stats', async (req: Request, res: Response) => {
  try {
    const clerkId = req.auth!.userId;

    // Look up the user to get their internal ID
    const [user] = await db
      .select({ id: users.id, subscriptionTier: users.subscriptionTier })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!user) {
      return res.json({
        success: true,
        data: {
          totalTrips: 0,
          totalSavings: 0,
          totalSearches: 0,
          subscriptionTier: 'free',
        },
      });
    }

    // Aggregate trip stats
    const [tripStats] = await db
      .select({
        totalTrips: sql<number>`count(*)::int`,
        totalSavings: sql<number>`coalesce(sum(${trips.totalSavings}::numeric), 0)`,
      })
      .from(trips)
      .where(eq(trips.userId, user.id));

    // Count bookings as proxy for searches
    const [bookingStats] = await db
      .select({
        totalSearches: sql<number>`count(*)::int`,
      })
      .from(bookings)
      .where(eq(bookings.userId, user.id));

    return res.json({
      success: true,
      data: {
        totalTrips: tripStats?.totalTrips ?? 0,
        totalSavings: Number(tripStats?.totalSavings ?? 0),
        totalSearches: bookingStats?.totalSearches ?? 0,
        subscriptionTier: user.subscriptionTier,
      },
    });
  } catch (err) {
    console.error('Get stats error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});
