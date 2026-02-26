import { pgTable, uuid, varchar, decimal, integer, boolean, text, date, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: varchar('clerk_id', { length: 255 }).unique().notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  subscriptionTier: varchar('subscription_tier', { length: 20 }).default('free').notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  perDiemSource: varchar('per_diem_source', { length: 20 }).default('gsa').notNull(),
  customLodgingRate: decimal('custom_lodging_rate', { precision: 10, scale: 2 }),
  customMieRate: decimal('custom_mie_rate', { precision: 10, scale: 2 }),
  referralCode: varchar('referral_code', { length: 20 }).unique(),
  referredBy: uuid('referred_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const trips = pgTable('trips', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  destination: varchar('destination', { length: 255 }).notNull(),
  destinationState: varchar('destination_state', { length: 2 }),
  origin: varchar('origin', { length: 255 }),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  lodgingRate: decimal('lodging_rate', { precision: 10, scale: 2 }).notNull(),
  mieRate: decimal('mie_rate', { precision: 10, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  totalSavings: decimal('total_savings', { precision: 10, scale: 2 }).default('0').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_trips_user').on(table.userId),
  index('idx_trips_status').on(table.status),
]);

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tripId: uuid('trip_id').references(() => trips.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 20 }).notNull(),
  provider: varchar('provider', { length: 100 }).notNull(),
  providerName: varchar('provider_name', { length: 255 }),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  perDiemDelta: decimal('per_diem_delta', { precision: 10, scale: 2 }),
  affiliatePartner: varchar('affiliate_partner', { length: 100 }),
  affiliateLink: text('affiliate_link'),
  bookingRef: varchar('booking_ref', { length: 255 }),
  loyaltyProgram: varchar('loyalty_program', { length: 100 }),
  loyaltyPointsEarned: integer('loyalty_points_earned').default(0).notNull(),
  discountCodeUsed: varchar('discount_code_used', { length: 100 }),
  checkIn: date('check_in'),
  checkOut: date('check_out'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_bookings_user').on(table.userId),
  index('idx_bookings_trip').on(table.tripId),
  index('idx_bookings_type').on(table.type),
]);

export const loyaltyAccounts = pgTable('loyalty_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  programName: varchar('program_name', { length: 100 }).notNull(),
  programCategory: varchar('program_category', { length: 20 }).notNull(),
  accountNumber: varchar('account_number', { length: 255 }),
  pointsBalance: integer('points_balance').default(0).notNull(),
  statusLevel: varchar('status_level', { length: 50 }),
  statusProgress: integer('status_progress').default(0).notNull(),
  statusNextTierAt: integer('status_next_tier_at'),
  pointValueCents: decimal('point_value_cents', { precision: 5, scale: 3 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('loyalty_user_program').on(table.userId, table.programName),
  index('idx_loyalty_user').on(table.userId),
]);

export const discountCodes = pgTable('discount_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 100 }).notNull(),
  provider: varchar('provider', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  value: decimal('value', { precision: 10, scale: 2 }),
  description: text('description'),
  source: varchar('source', { length: 100 }).notNull(),
  sourceUrl: text('source_url'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  isValidated: boolean('is_validated').default(false).notNull(),
  lastValidatedAt: timestamp('last_validated_at', { withTimezone: true }),
  successRate: decimal('success_rate', { precision: 3, scale: 2 }).default('0').notNull(),
  upvotes: integer('upvotes').default(0).notNull(),
  downvotes: integer('downvotes').default(0).notNull(),
  applicableTo: varchar('applicable_to', { length: 20 }).default('all').notNull(),
  submittedBy: uuid('submitted_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_discount_codes_provider').on(table.provider),
  index('idx_discount_codes_applicable').on(table.applicableTo),
  index('idx_discount_codes_expires').on(table.expiresAt),
]);

export const meals = pgTable('meals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tripId: uuid('trip_id').references(() => trips.id, { onDelete: 'cascade' }).notNull(),
  date: date('date').notNull(),
  mealType: varchar('meal_type', { length: 20 }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  vendor: varchar('vendor', { length: 255 }),
  notes: text('notes'),
  receiptUrl: text('receipt_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_meals_trip_date').on(table.tripId, table.date),
  index('idx_meals_user').on(table.userId),
]);

export const receipts = pgTable('receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tripId: uuid('trip_id').references(() => trips.id, { onDelete: 'set null' }),
  imageUrl: text('image_url').notNull(),
  ocrVendor: varchar('ocr_vendor', { length: 255 }),
  ocrAmount: decimal('ocr_amount', { precision: 10, scale: 2 }),
  ocrDate: date('ocr_date'),
  ocrCategory: varchar('ocr_category', { length: 50 }),
  isVerified: boolean('is_verified').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_receipts_user').on(table.userId),
]);

export const perdiemRates = pgTable('perdiem_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  fiscalYear: integer('fiscal_year').notNull(),
  state: varchar('state', { length: 2 }).notNull(),
  city: varchar('city', { length: 255 }).notNull(),
  county: varchar('county', { length: 255 }),
  lodgingRate: decimal('lodging_rate', { precision: 10, scale: 2 }).notNull(),
  mieRate: decimal('mie_rate', { precision: 10, scale: 2 }).notNull(),
  month: integer('month'),
  effectiveDate: date('effective_date'),
}, (table) => [
  uniqueIndex('perdiem_rates_lookup_unique').on(table.fiscalYear, table.state, table.city, table.county, table.month),
  index('idx_perdiem_rates_lookup').on(table.fiscalYear, table.state, table.city),
]);

export const loyaltyValuations = pgTable('loyalty_valuations', {
  id: uuid('id').primaryKey().defaultRandom(),
  programName: varchar('program_name', { length: 100 }).unique().notNull(),
  pointValueCents: decimal('point_value_cents', { precision: 5, scale: 3 }).notNull(),
  bestRedemptionType: varchar('best_redemption_type', { length: 100 }),
  source: varchar('source', { length: 100 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const featuredListings = pgTable('featured_listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  advertiserName: varchar('advertiser_name', { length: 255 }).notNull(),
  listingType: varchar('listing_type', { length: 50 }).notNull(),
  targetDestinations: text('target_destinations').array(),
  creativeUrl: text('creative_url'),
  landingUrl: text('landing_url').notNull(),
  cpcRate: decimal('cpc_rate', { precision: 10, scale: 4 }),
  cpmRate: decimal('cpm_rate', { precision: 10, scale: 4 }),
  monthlyFee: decimal('monthly_fee', { precision: 10, scale: 2 }),
  impressions: integer('impressions').default(0).notNull(),
  clicks: integer('clicks').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_featured_active').on(table.isActive),
]);

export const scraperLogs = pgTable('scraper_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: varchar('source', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  codesFound: integer('codes_found').default(0).notNull(),
  codesNew: integer('codes_new').default(0).notNull(),
  durationMs: integer('duration_ms'),
  errorMessage: text('error_message'),
  runAt: timestamp('run_at', { withTimezone: true }).defaultNow().notNull(),
});
