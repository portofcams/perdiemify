import { Router, Request, Response } from 'express';
import { eq, and, sql, lte, gte } from 'drizzle-orm';
import { db } from '../db';
import { featuredListings } from '../db/schema';

export const featuredListingsRouter = Router();

/**
 * GET /api/featured-listings — Serve active featured listings
 * Query: ?type=hotel&destination=Washington
 */
featuredListingsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { type, destination } = req.query;
    const now = new Date();

    const listings = await db
      .select()
      .from(featuredListings)
      .where(
        and(
          eq(featuredListings.isActive, true),
          sql`(${featuredListings.startsAt} IS NULL OR ${featuredListings.startsAt} <= ${now})`,
          sql`(${featuredListings.endsAt} IS NULL OR ${featuredListings.endsAt} >= ${now})`,
          type ? eq(featuredListings.listingType, type as string) : undefined,
        )
      )
      .limit(3);

    // Filter by destination if provided
    const filtered = destination
      ? listings.filter(
          (l) =>
            !l.targetDestinations ||
            l.targetDestinations.length === 0 ||
            l.targetDestinations.some((d) =>
              d.toLowerCase().includes((destination as string).toLowerCase())
            )
        )
      : listings;

    // Increment impressions
    for (const listing of filtered) {
      await db
        .update(featuredListings)
        .set({ impressions: sql<number>`coalesce(${featuredListings.impressions}, 0) + 1` })
        .where(eq(featuredListings.id, listing.id as string));
    }

    return res.json({ success: true, data: filtered });
  } catch (err) {
    console.error('Featured listings error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch featured listings' });
  }
});

/**
 * POST /api/featured-listings/:id/click — Track a click
 */
featuredListingsRouter.post('/:id/click', async (req: Request, res: Response) => {
  try {
    const [listing] = await db
      .select({ id: featuredListings.id, landingUrl: featuredListings.landingUrl })
      .from(featuredListings)
      .where(eq(featuredListings.id, req.params.id as string))
      .limit(1);

    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    await db
      .update(featuredListings)
      .set({ clicks: sql<number>`coalesce(${featuredListings.clicks}, 0) + 1` })
      .where(eq(featuredListings.id, req.params.id as string));

    return res.json({ success: true, data: { landingUrl: listing.landingUrl } });
  } catch (err) {
    console.error('Featured listing click error:', err);
    return res.status(500).json({ success: false, error: 'Failed to track click' });
  }
});
