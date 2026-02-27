import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';

export const usersRouter = Router();

// All user routes require authentication
usersRouter.use(requireAuth);

/**
 * GET /api/users/me — Get current user's profile
 */
usersRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const clerkId = req.auth!.userId;

    // TODO: Fetch from DB when connected
    // const user = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);

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

    console.log(`Updating profile for ${clerkId}:`, { name, perDiemSource, customLodgingRate, customMieRate });

    // TODO: Update in DB when connected
    // await db.update(users)
    //   .set({ name, perDiemSource, customLodgingRate, customMieRate, updatedAt: new Date() })
    //   .where(eq(users.clerkId, clerkId));

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
    // TODO: Aggregate from DB when connected
    return res.json({
      success: true,
      data: {
        totalTrips: 0,
        totalSavings: 0,
        totalSearches: 0,
        subscriptionTier: 'free',
      },
    });
  } catch (err) {
    console.error('Get stats error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});
