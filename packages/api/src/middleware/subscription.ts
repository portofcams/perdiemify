import { Request, Response, NextFunction } from 'express';
import type { SubscriptionTier } from '@perdiemify/shared';

/**
 * Middleware to enforce subscription tier requirements.
 * Must be used AFTER requireAuth middleware.
 *
 * For MVP, checks a simple cache/DB lookup. In production,
 * this would query the users table for the subscription tier.
 */

// In-memory tier cache — refreshed from DB on each request in production
// For MVP, default everyone to 'free' and check against search limits
const SEARCH_LIMITS: Record<SubscriptionTier, number> = {
  free: 5,
  pro: 999999,
  proplus: 999999,
};

// Simple in-memory rate tracker (resets daily in production use Redis)
const dailySearchCounts: Map<string, { count: number; date: string }> = new Map();

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Rate limit searches based on subscription tier.
 * Requires req.auth to be populated by requireAuth middleware.
 */
export function searchRateLimit(req: Request, res: Response, next: NextFunction): void {
  const userId = req.auth?.userId;
  if (!userId) {
    // No auth = treat as free tier
    next();
    return;
  }

  const today = getTodayKey();
  const entry = dailySearchCounts.get(userId);

  if (!entry || entry.date !== today) {
    dailySearchCounts.set(userId, { count: 1, date: today });
    next();
    return;
  }

  // For MVP, treat all users as free tier. Once DB lookup is wired,
  // we'll check the actual subscription tier.
  const tier: SubscriptionTier = 'free';
  const limit = SEARCH_LIMITS[tier];

  if (entry.count >= limit) {
    res.status(429).json({
      success: false,
      error: `Daily search limit reached (${limit}). Upgrade to Pro for unlimited searches.`,
      upgradeUrl: '/dashboard/billing',
    });
    return;
  }

  entry.count++;
  next();
}

/**
 * Require a minimum subscription tier.
 */
export function requireTier(minTier: SubscriptionTier) {
  const tierLevel: Record<SubscriptionTier, number> = {
    free: 0,
    pro: 1,
    proplus: 2,
  };

  return (_req: Request, res: Response, next: NextFunction): void => {
    // For MVP, allow all requests. Once DB is wired, check actual tier.
    // const userTier = getUserTier(req.auth?.userId);
    const userTier: SubscriptionTier = 'free'; // placeholder

    if (tierLevel[userTier] >= tierLevel[minTier]) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: `This feature requires ${minTier} plan or higher.`,
      upgradeUrl: '/dashboard/billing',
    });
  };
}
