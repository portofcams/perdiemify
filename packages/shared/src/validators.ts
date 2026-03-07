import { z } from 'zod';

export const searchParamsSchema = z.object({
  destination: z.string().min(1, 'Destination is required'),
  destinationState: z.string().length(2).optional(),
  origin: z.string().optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  adults: z.number().int().min(1).max(9).default(1),
  type: z.enum(['hotel', 'flight', 'car']),
});

export const tripSchema = z.object({
  name: z.string().min(1).max(255),
  destination: z.string().min(1).max(255),
  destinationState: z.string().length(2).optional(),
  origin: z.string().max(255).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lodgingRate: z.number().positive(),
  mieRate: z.number().positive(),
  notes: z.string().optional(),
});

export const mealSchema = z.object({
  tripId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'incidental']),
  amount: z.number().min(0),
  vendor: z.string().max(255).optional(),
  notes: z.string().optional(),
});

export const loyaltyAccountSchema = z.object({
  programName: z.string().min(1).max(100),
  programCategory: z.enum(['airline', 'hotel', 'car', 'credit_card']),
  accountNumber: z.string().max(255).optional(),
  pointsBalance: z.number().int().min(0).default(0),
  statusLevel: z.string().max(50).optional(),
  statusProgress: z.number().int().min(0).max(100).default(0),
  statusNextTierAt: z.number().int().positive().optional(),
});

export const userProfileSchema = z.object({
  name: z.string().max(255).optional(),
  perDiemSource: z.enum(['gsa', 'jtr', 'corporate', 'custom']),
  customLodgingRate: z.number().positive().optional(),
  customMieRate: z.number().positive().optional(),
});

// --- Partial schemas for PATCH endpoints ---

export const tripUpdateSchema = tripSchema.partial().extend({
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
  totalSavings: z.number().min(0).optional(),
});

// --- Additional endpoint schemas ---

export const alertSchema = z.object({
  destination: z.string().min(1).max(255),
  destinationState: z.string().length(2).optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  targetPrice: z.number().positive(),
  tripId: z.string().uuid().optional(),
});

export const billingCheckoutSchema = z.object({
  plan: z.enum(['pro', 'proplus']),
});

export const dealSubmitSchema = z.object({
  code: z.string().min(2).max(50),
  provider: z.string().min(1).max(100),
  type: z.enum(['percent', 'fixed', 'promo']).optional(),
  value: z.number().optional(),
  description: z.string().max(500).optional(),
  applicableTo: z.enum(['hotel', 'flight', 'car', 'all']).optional(),
});

export const dealVoteSchema = z.object({
  vote: z.enum(['up', 'down']),
});

export const waitlistSchema = z.object({
  email: z.string().email('Valid email address required'),
});

export const perdiemCalcSchema = z.object({
  city: z.string().min(1),
  state: z.string().min(1),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  perDiemSource: z.enum(['gsa', 'jtr', 'corporate', 'custom']).optional(),
  customLodgingRate: z.number().positive().optional(),
  customMieRate: z.number().positive().optional(),
});

export const oconusCalcSchema = z.object({
  countryCode: z.string().min(2).max(3),
  location: z.string().min(1),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
});

export const receiptUpdateSchema = z.object({
  ocrVendor: z.string().max(255).optional(),
  ocrAmount: z.number().min(0).nullable().optional(),
  ocrDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  ocrCategory: z.string().max(50).nullable().optional(),
  isVerified: z.boolean().optional(),
  tripId: z.string().uuid().nullable().optional(),
});

export const loyaltyRecommendSchema = z.object({
  bookingType: z.enum(['hotel', 'flight', 'car']),
  provider: z.string().min(1),
  amountUsd: z.number().positive(),
});

export const expensifyConnectSchema = z.object({
  partnerUserID: z.string().min(1),
  partnerUserSecret: z.string().min(1),
  employeeEmail: z.string().email().optional(),
});

export const integrationPushSchema = z.object({
  provider: z.enum(['concur', 'expensify']),
});

export const bookingSchema = z.object({
  tripId: z.string().uuid().nullable().optional(),
  type: z.enum(['hotel', 'flight', 'car']),
  provider: z.string().min(1).max(100),
  providerName: z.string().max(255).optional(),
  price: z.number().positive(),
  perDiemDelta: z.number().optional(),
  affiliatePartner: z.string().max(100).optional(),
  affiliateLink: z.string().url().optional(),
  bookingRef: z.string().max(255).optional(),
  loyaltyProgram: z.string().max(100).optional(),
  loyaltyPointsEarned: z.number().int().min(0).default(0),
  discountCodeUsed: z.string().max(100).optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const bookingUpdateSchema = bookingSchema.partial();

// --- Type exports ---

export type SearchParamsInput = z.infer<typeof searchParamsSchema>;
export type TripInput = z.infer<typeof tripSchema>;
export type MealInput = z.infer<typeof mealSchema>;
export type LoyaltyAccountInput = z.infer<typeof loyaltyAccountSchema>;
export type UserProfileInput = z.infer<typeof userProfileSchema>;
