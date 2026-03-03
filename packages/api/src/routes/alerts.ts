import { Router, Request, Response } from 'express';
import { eq, desc, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { alertSchema } from '@perdiemify/shared';
import { db } from '../db';
import { users, priceAlerts, trips } from '../db/schema';

export const alertsRouter = Router();

alertsRouter.use(requireAuth);

async function getUserId(clerkId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return user?.id ?? null;
}

/** GET /api/alerts — List all price alerts for the user */
alertsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) return res.json({ success: true, data: [] });

    const alerts = await db
      .select()
      .from(priceAlerts)
      .where(eq(priceAlerts.userId, userId))
      .orderBy(desc(priceAlerts.createdAt));

    return res.json({ success: true, data: alerts });
  } catch (err: unknown) {
    console.error('List alerts error:', err);
    return res.status(500).json({ success: false, error: 'Failed to list alerts' });
  }
});

/** POST /api/alerts — Create a new price alert */
alertsRouter.post('/', validateBody(alertSchema), async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) return res.status(400).json({ success: false, error: 'User not found' });

    const { destination, destinationState, checkIn, checkOut, targetPrice, tripId } = req.body;

    const [alert] = await db
      .insert(priceAlerts)
      .values({
        userId,
        tripId: tripId || null,
        destination,
        destinationState: destinationState || null,
        checkIn,
        checkOut,
        targetPrice: String(targetPrice),
      })
      .returning();

    return res.status(201).json({ success: true, data: alert });
  } catch (err: unknown) {
    console.error('Create alert error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create alert' });
  }
});

/** POST /api/alerts/from-trip/:tripId — Create alert from a trip's data */
alertsRouter.post('/from-trip/:tripId', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) return res.status(400).json({ success: false, error: 'User not found' });

    const tripId = req.params.tripId as string;

    const [trip] = await db
      .select()
      .from(trips)
      .where(sql`${trips.id} = ${tripId} AND ${trips.userId} = ${userId}`)
      .limit(1);

    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    const [alert] = await db
      .insert(priceAlerts)
      .values({
        userId,
        tripId: trip.id,
        destination: trip.destination,
        destinationState: trip.destinationState,
        checkIn: trip.startDate,
        checkOut: trip.endDate,
        targetPrice: trip.lodgingRate,
      })
      .returning();

    return res.status(201).json({ success: true, data: alert });
  } catch (err: unknown) {
    console.error('Create alert from trip error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create alert from trip' });
  }
});

/** PATCH /api/alerts/:id — Toggle active/inactive */
alertsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) return res.status(404).json({ success: false, error: 'Alert not found' });

    const alertId = req.params.id as string;

    const [existing] = await db
      .select({ userId: priceAlerts.userId })
      .from(priceAlerts)
      .where(sql`${priceAlerts.id} = ${alertId}`)
      .limit(1);

    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    const { isActive } = req.body;
    const [updated] = await db
      .update(priceAlerts)
      .set({ isActive: isActive !== undefined ? isActive : true })
      .where(sql`${priceAlerts.id} = ${alertId}`)
      .returning();

    return res.json({ success: true, data: updated });
  } catch (err: unknown) {
    console.error('Update alert error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update alert' });
  }
});

/** DELETE /api/alerts/:id — Delete a price alert */
alertsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) return res.status(404).json({ success: false, error: 'Alert not found' });

    const alertId = req.params.id as string;

    const [existing] = await db
      .select({ userId: priceAlerts.userId })
      .from(priceAlerts)
      .where(sql`${priceAlerts.id} = ${alertId}`)
      .limit(1);

    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    await db.delete(priceAlerts).where(sql`${priceAlerts.id} = ${alertId}`);
    return res.json({ success: true, message: 'Alert deleted' });
  } catch (err: unknown) {
    console.error('Delete alert error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete alert' });
  }
});
