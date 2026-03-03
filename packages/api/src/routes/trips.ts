import { Router, Request, Response } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { tripSchema, tripUpdateSchema } from '@perdiemify/shared';
import { db } from '../db';
import { users, trips } from '../db/schema';
import { buildItinerary } from '../services/itinerary-builder';

export const tripsRouter = Router();

tripsRouter.use(requireAuth);

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
 * GET /api/trips — List all trips for the current user
 */
tripsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.json({ success: true, data: [] });
    }

    const userTrips = await db
      .select()
      .from(trips)
      .where(eq(trips.userId, userId))
      .orderBy(desc(trips.startDate));

    return res.json({ success: true, data: userTrips });
  } catch (err) {
    console.error('List trips error:', err);
    return res.status(500).json({ success: false, error: 'Failed to list trips' });
  }
});

/**
 * GET /api/trips/:id — Get a single trip
 */
tripsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    const [trip] = await db
      .select()
      .from(trips)
      .where(eq(trips.id, req.params.id as string))
      .limit(1);

    if (!trip || trip.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    return res.json({ success: true, data: trip });
  } catch (err) {
    console.error('Get trip error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get trip' });
  }
});

/**
 * POST /api/trips — Create a new trip
 */
tripsRouter.post('/', validateBody(tripSchema), async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User not found in database. Please sign out and back in.' });
    }

    const { name, destination, destinationState, origin, startDate, endDate, lodgingRate, mieRate, notes } = req.body;

    const [newTrip] = await db
      .insert(trips)
      .values({
        userId,
        name,
        destination,
        destinationState: destinationState || null,
        origin: origin || null,
        startDate,
        endDate,
        lodgingRate: String(lodgingRate),
        mieRate: String(mieRate),
        status: 'active',
        totalSavings: '0',
        notes: notes || null,
      })
      .returning();

    return res.status(201).json({ success: true, data: newTrip });
  } catch (err) {
    console.error('Create trip error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create trip' });
  }
});

/**
 * PATCH /api/trips/:id — Update a trip
 */
tripsRouter.patch('/:id', validateBody(tripUpdateSchema), async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    // Verify ownership
    const [existing] = await db
      .select({ userId: trips.userId })
      .from(trips)
      .where(eq(trips.id, req.params.id as string))
      .limit(1);

    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    const { name, destination, destinationState, origin, startDate, endDate, lodgingRate, mieRate, status, totalSavings, notes } = req.body;

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateFields.name = name;
    if (destination !== undefined) updateFields.destination = destination;
    if (destinationState !== undefined) updateFields.destinationState = destinationState;
    if (origin !== undefined) updateFields.origin = origin;
    if (startDate !== undefined) updateFields.startDate = startDate;
    if (endDate !== undefined) updateFields.endDate = endDate;
    if (lodgingRate !== undefined) updateFields.lodgingRate = String(lodgingRate);
    if (mieRate !== undefined) updateFields.mieRate = String(mieRate);
    if (status !== undefined) updateFields.status = status;
    if (totalSavings !== undefined) updateFields.totalSavings = String(totalSavings);
    if (notes !== undefined) updateFields.notes = notes;

    const [updated] = await db
      .update(trips)
      .set(updateFields)
      .where(eq(trips.id, req.params.id as string))
      .returning();

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update trip error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update trip' });
  }
});

/**
 * DELETE /api/trips/:id — Delete a trip
 */
tripsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    // Verify ownership
    const [existing] = await db
      .select({ userId: trips.userId })
      .from(trips)
      .where(eq(trips.id, req.params.id as string))
      .limit(1);

    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    await db.delete(trips).where(eq(trips.id, req.params.id as string));

    return res.json({ success: true, message: 'Trip deleted' });
  } catch (err) {
    console.error('Delete trip error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete trip' });
  }
});

/**
 * POST /api/trips/:id/itinerary — Build optimized itinerary for a trip
 */
tripsRouter.post('/:id/itinerary', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    // Verify ownership
    const [trip] = await db
      .select({ userId: trips.userId })
      .from(trips)
      .where(eq(trips.id, req.params.id as string))
      .limit(1);

    if (!trip || trip.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    const itinerary = await buildItinerary(req.params.id as string);
    return res.json({ success: true, data: itinerary });
  } catch (err) {
    console.error('Build itinerary error:', err);
    return res.status(500).json({ success: false, error: 'Failed to build itinerary' });
  }
});
