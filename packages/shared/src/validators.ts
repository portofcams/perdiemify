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

export type SearchParamsInput = z.infer<typeof searchParamsSchema>;
export type TripInput = z.infer<typeof tripSchema>;
export type MealInput = z.infer<typeof mealSchema>;
export type LoyaltyAccountInput = z.infer<typeof loyaltyAccountSchema>;
export type UserProfileInput = z.infer<typeof userProfileSchema>;
