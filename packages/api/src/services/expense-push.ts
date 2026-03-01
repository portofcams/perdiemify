/**
 * Expense Push Service — Phase 5 Feature 5
 *
 * Pushes expense reports to SAP Concur or Expensify via their APIs.
 * Reads trip data + receipts, formats the expense report, and pushes.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { trips, receipts, meals, integrations, users } from '../db/schema';

export type ExpenseProvider = 'concur' | 'expensify';

export interface PushResult {
  status: 'success' | 'failed' | 'no_integration';
  provider: ExpenseProvider;
  externalReportId?: string;
  entriesPushed?: number;
  error?: string;
}

// ─── Main Push Function ─────────────────────────────────────────

export async function pushExpenseReport(
  userId: string,
  tripId: string,
  provider: ExpenseProvider,
): Promise<PushResult> {
  // Check integration exists and is active
  const [integration] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.userId, userId),
        eq(integrations.provider, provider),
        eq(integrations.isActive, true),
      )
    )
    .limit(1);

  if (!integration) {
    return { status: 'no_integration', provider, error: `No active ${provider} integration found` };
  }

  // Load trip data
  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
    .limit(1);

  if (!trip) {
    return { status: 'failed', provider, error: 'Trip not found' };
  }

  // Load receipts for this trip
  const tripReceipts = await db
    .select()
    .from(receipts)
    .where(and(eq(receipts.tripId, tripId), eq(receipts.userId, userId)));

  // Load meals for this trip
  const tripMeals = await db
    .select()
    .from(meals)
    .where(and(eq(meals.tripId, tripId), eq(meals.userId, userId)));

  // Build expense entries
  const entries = buildExpenseEntries(trip, tripReceipts, tripMeals);

  try {
    if (provider === 'concur') {
      return await pushToConcur(integration, trip, entries);
    } else {
      return await pushToExpensify(integration, trip, entries);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ExpensePush] Push to ${provider} failed:`, message);
    return { status: 'failed', provider, error: message };
  }
}

// ─── Expense Entry Builder ──────────────────────────────────────

interface ExpenseEntry {
  date: string;
  category: string;
  vendor: string;
  amount: number;
  description: string;
  hasReceipt: boolean;
}

function buildExpenseEntries(
  trip: typeof trips.$inferSelect,
  tripReceipts: Array<typeof receipts.$inferSelect>,
  tripMeals: Array<typeof meals.$inferSelect>,
): ExpenseEntry[] {
  const entries: ExpenseEntry[] = [];

  // Add receipts as expense entries
  for (const receipt of tripReceipts) {
    if (receipt.status !== 'ready') continue;
    entries.push({
      date: receipt.ocrDate || trip.startDate,
      category: receipt.ocrCategory || 'other',
      vendor: receipt.ocrVendor || 'Unknown',
      amount: receipt.ocrAmount ? parseFloat(receipt.ocrAmount) : 0,
      description: `Receipt: ${receipt.ocrVendor || 'Unknown vendor'}`,
      hasReceipt: true,
    });
  }

  // Add meals as expense entries
  for (const meal of tripMeals) {
    entries.push({
      date: meal.date,
      category: 'meals',
      vendor: meal.vendor || 'Unknown',
      amount: parseFloat(meal.amount),
      description: `${meal.mealType} - ${meal.vendor || 'Unknown'}`,
      hasReceipt: !!meal.receiptUrl,
    });
  }

  // Add lodging per diem entry for each night
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const lodgingRate = parseFloat(trip.lodgingRate);
  const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  for (let i = 0; i < nights; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    entries.push({
      date: d.toISOString().split('T')[0],
      category: 'lodging',
      vendor: trip.destination,
      amount: lodgingRate,
      description: `Lodging - ${trip.destination} (per diem)`,
      hasReceipt: false,
    });
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Concur API ─────────────────────────────────────────────────

const CONCUR_BASE = 'https://us.api.concursolutions.com';

async function pushToConcur(
  integration: typeof integrations.$inferSelect,
  trip: typeof trips.$inferSelect,
  entries: ExpenseEntry[],
): Promise<PushResult> {
  const token = integration.accessToken;
  if (!token) {
    return { status: 'failed', provider: 'concur', error: 'No access token' };
  }

  // Check if token is expired and needs refresh
  if (integration.tokenExpiresAt && new Date(integration.tokenExpiresAt) < new Date()) {
    return { status: 'failed', provider: 'concur', error: 'Token expired — reconnect required' };
  }

  // Create expense report
  const reportRes = await fetch(`${CONCUR_BASE}/api/v3.0/expense/reports`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Name: `${trip.name} - Perdiemify`,
      CurrencyCode: 'USD',
      Comment: `Generated by Perdiemify for trip to ${trip.destination}`,
    }),
  });

  if (!reportRes.ok) {
    const body = await reportRes.text();
    throw new Error(`Concur create report error ${reportRes.status}: ${body}`);
  }

  const reportData = await reportRes.json() as { ID: string };
  const reportId = reportData.ID;

  // Add expense entries
  let pushed = 0;
  for (const entry of entries) {
    const entryRes = await fetch(`${CONCUR_BASE}/api/v3.0/expense/entries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ReportID: reportId,
        TransactionDate: entry.date,
        ExpenseTypeName: mapCategoryToConcur(entry.category),
        TransactionAmount: entry.amount,
        TransactionCurrencyCode: 'USD',
        VendorDescription: entry.vendor,
        Comment: entry.description,
      }),
    });

    if (entryRes.ok) pushed++;
  }

  return {
    status: 'success',
    provider: 'concur',
    externalReportId: reportId,
    entriesPushed: pushed,
  };
}

function mapCategoryToConcur(category: string): string {
  const map: Record<string, string> = {
    lodging: 'Hotel',
    meals: 'Meals',
    transport: 'Car Rental',
    parking: 'Parking',
    tips: 'Tips',
    other: 'Miscellaneous',
  };
  return map[category] || 'Miscellaneous';
}

// ─── Expensify API ──────────────────────────────────────────────

const EXPENSIFY_BASE = 'https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations';

async function pushToExpensify(
  integration: typeof integrations.$inferSelect,
  trip: typeof trips.$inferSelect,
  entries: ExpenseEntry[],
): Promise<PushResult> {
  const credentials = integration.accessToken;
  if (!credentials) {
    return { status: 'failed', provider: 'expensify', error: 'No API credentials' };
  }

  // Parse stored credentials (format: "partnerUserID:partnerUserSecret")
  const [partnerUserID, partnerUserSecret] = credentials.split(':');
  if (!partnerUserID || !partnerUserSecret) {
    return { status: 'failed', provider: 'expensify', error: 'Invalid credential format' };
  }

  // Build transaction list
  const transactionList = entries.map((entry) => ({
    created: entry.date,
    currency: 'USD',
    merchant: entry.vendor,
    amount: Math.round(entry.amount * 100), // Expensify uses cents
    category: mapCategoryToExpensify(entry.category),
    comment: entry.description,
    tag: trip.destination,
  }));

  const requestBody = new URLSearchParams({
    requestJobDescription: JSON.stringify({
      type: 'create',
      credentials: { partnerUserID, partnerUserSecret },
      inputSettings: {
        type: 'transactions',
        employeeEmail: integration.externalUserId || '',
      },
      outputSettings: {
        type: 'reimburse',
      },
    }),
    inputSettings: JSON.stringify({
      transactionList,
    }),
  });

  const res = await fetch(EXPENSIFY_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: requestBody,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Expensify API error ${res.status}: ${body}`);
  }

  const result = await res.text();

  return {
    status: 'success',
    provider: 'expensify',
    externalReportId: result.trim(),
    entriesPushed: entries.length,
  };
}

function mapCategoryToExpensify(category: string): string {
  const map: Record<string, string> = {
    lodging: 'Accommodation',
    meals: 'Meals & Entertainment',
    transport: 'Transportation',
    parking: 'Parking',
    tips: 'Tips',
    other: 'Other',
  };
  return map[category] || 'Other';
}
