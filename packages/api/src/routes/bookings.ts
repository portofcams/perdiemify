import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { bookingSchema, bookingUpdateSchema } from '@perdiemify/shared';
import { db } from '../db';
import { users, bookings } from '../db/schema';

export const bookingsRouter = Router();

async function getUserId(clerkId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return user?.id ?? null;
}

/**
 * GET /api/bookings — List user's bookings
 * Query: ?tripId=uuid&type=hotel
 */
bookingsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) return res.json({ success: true, data: [] });

    const conditions = [eq(bookings.userId, userId)];
    if (req.query.tripId) conditions.push(eq(bookings.tripId, req.query.tripId as string));
    if (req.query.type) conditions.push(eq(bookings.type, req.query.type as string));

    const results = await db
      .select()
      .from(bookings)
      .where(and(...conditions))
      .orderBy(desc(bookings.createdAt));

    return res.json({ success: true, data: results });
  } catch (err) {
    console.error('List bookings error:', err);
    return res.status(500).json({ success: false, error: 'Failed to list bookings' });
  }
});

/**
 * GET /api/bookings/:id — Get a single booking
 */
bookingsRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) return res.status(404).json({ success: false, error: 'Booking not found' });

    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, req.params.id as string), eq(bookings.userId, userId)))
      .limit(1);

    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
    return res.json({ success: true, data: booking });
  } catch (err) {
    console.error('Get booking error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get booking' });
  }
});

/**
 * POST /api/bookings — Create a booking
 */
bookingsRouter.post('/', requireAuth, validateBody(bookingSchema), async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) return res.status(400).json({ success: false, error: 'User not found' });

    const [booking] = await db
      .insert(bookings)
      .values({ userId, ...req.body })
      .returning();

    return res.status(201).json({ success: true, data: booking });
  } catch (err) {
    console.error('Create booking error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create booking' });
  }
});

/**
 * PATCH /api/bookings/:id — Update a booking
 */
bookingsRouter.patch('/:id', requireAuth, validateBody(bookingUpdateSchema), async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) return res.status(404).json({ success: false, error: 'Booking not found' });

    const [existing] = await db
      .select({ userId: bookings.userId })
      .from(bookings)
      .where(eq(bookings.id, req.params.id as string))
      .limit(1);

    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const [updated] = await db
      .update(bookings)
      .set(req.body)
      .where(eq(bookings.id, req.params.id as string))
      .returning();

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update booking error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update booking' });
  }
});

/**
 * DELETE /api/bookings/:id — Delete a booking
 */
bookingsRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) return res.status(404).json({ success: false, error: 'Booking not found' });

    const [existing] = await db
      .select({ userId: bookings.userId })
      .from(bookings)
      .where(eq(bookings.id, req.params.id as string))
      .limit(1);

    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    await db.delete(bookings).where(eq(bookings.id, req.params.id));
    return res.json({ success: true, message: 'Booking deleted' });
  } catch (err) {
    console.error('Delete booking error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete booking' });
  }
});
