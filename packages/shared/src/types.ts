// === User Types ===
export type SubscriptionTier = 'free' | 'pro' | 'proplus';
export type PerDiemSource = 'gsa' | 'jtr' | 'corporate' | 'custom';
export type TripStatus = 'active' | 'completed' | 'cancelled';
export type BookingType = 'hotel' | 'flight' | 'car';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'incidental';
export type DiscountType = 'percent' | 'fixed' | 'promo';
export type LoyaltyCategory = 'airline' | 'hotel' | 'car' | 'credit_card';
export type PerDiemBadge = 'under' | 'near' | 'over';

export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  subscriptionTier: SubscriptionTier;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  perDiemSource: PerDiemSource;
  customLodgingRate: number | null;
  customMieRate: number | null;
  referralCode: string | null;
  referredBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// === Trip Types ===
export interface Trip {
  id: string;
  userId: string;
  name: string;
  destination: string;
  destinationState: string | null;
  origin: string | null;
  startDate: string;
  endDate: string;
  lodgingRate: number;
  mieRate: number;
  status: TripStatus;
  totalSavings: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// === Booking Types ===
export interface Booking {
  id: string;
  userId: string;
  tripId: string | null;
  type: BookingType;
  provider: string;
  providerName: string | null;
  price: number;
  perDiemDelta: number | null;
  affiliatePartner: string | null;
  affiliateLink: string | null;
  bookingRef: string | null;
  loyaltyProgram: string | null;
  loyaltyPointsEarned: number;
  discountCodeUsed: string | null;
  checkIn: string | null;
  checkOut: string | null;
  createdAt: Date;
}

// === Search Types ===
export interface SearchParams {
  destination: string;
  destinationState?: string;
  origin?: string;
  checkIn: string;
  checkOut: string;
  adults?: number;
  type: BookingType;
}

export interface PerDiemRates {
  lodgingRate: number;
  mieRate: number;
  firstLastDayRate: number;
  totalAllowance: number;
  totalLodgingAllowance: number;
  totalMieAllowance: number;
  nights: number;
  days: number;
}

export interface SearchResult {
  id: string;
  type: BookingType;
  provider: string;
  providerName: string;
  name: string;
  description: string | null;
  price: number;
  pricePerNight?: number;
  currency: string;
  perDiemDelta: number;
  perDiemBadge: PerDiemBadge;
  affiliateLink: string;
  imageUrl: string | null;
  rating: number | null;
  loyaltyProgram: string | null;
  estimatedPoints: number | null;
  discountCodes: DiscountCode[];
  amenities: string[];
  location: string | null;
}

export interface SearchResponse {
  results: SearchResult[];
  perDiemRates: PerDiemRates;
  savingsMax: SearchResult | null;
  smartValue: SearchResult | null;
  cached: boolean;
  searchId: string;
}

// === Discount Code Types ===
export interface DiscountCode {
  id: string;
  code: string;
  provider: string;
  type: DiscountType;
  value: number | null;
  description: string | null;
  source: string;
  sourceUrl: string | null;
  expiresAt: Date | null;
  isValidated: boolean;
  successRate: number;
  upvotes: number;
  downvotes: number;
  applicableTo: BookingType | 'all';
}

// === Loyalty Types ===
export interface LoyaltyAccount {
  id: string;
  userId: string;
  programName: string;
  programCategory: LoyaltyCategory;
  accountNumber: string | null;
  pointsBalance: number;
  statusLevel: string | null;
  statusProgress: number;
  statusNextTierAt: number | null;
  pointValueCents: number | null;
  updatedAt: Date;
}

export interface LoyaltyValuation {
  programName: string;
  pointValueCents: number;
  bestRedemptionType: string | null;
  source: string | null;
  updatedAt: Date;
}

// === Meal Types ===
export interface Meal {
  id: string;
  userId: string;
  tripId: string;
  date: string;
  mealType: MealType;
  amount: number;
  vendor: string | null;
  notes: string | null;
  receiptUrl: string | null;
  createdAt: Date;
}

export interface DailyMealSummary {
  date: string;
  meals: Meal[];
  totalSpent: number;
  mieAllowance: number;
  remaining: number;
  isFirstOrLastDay: boolean;
}

// === Per Diem Rate (cached from GSA) ===
export interface PerDiemRate {
  id: string;
  fiscalYear: number;
  state: string;
  city: string;
  county: string | null;
  lodgingRate: number;
  mieRate: number;
  month: number | null;
  effectiveDate: string | null;
}

// === API Response wrapper ===
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
