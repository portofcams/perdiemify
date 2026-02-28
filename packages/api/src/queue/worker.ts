import 'dotenv/config';
import { Worker } from 'bullmq';
import { createWorkerConnection } from './connection';
import { perdiemSyncQueue, discountValidationQueue, loyaltyValuationQueue } from './queues';
import { syncAllPerDiemRates, getCachedRateCount } from '../services/gsa-rate-sync';
import { sendDealAlerts } from '../services/deal-alerts';
import { recalculateSuccessRates, expireStaleCode } from '../services/discount-engine';
import { syncLoyaltyValuations } from '../services/loyalty-tracker';
import { processReceiptImage, shutdownOcr } from '../services/receipt-ocr';
import { getStorage } from '../utils/storage';
import { receipts } from '../db/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { getCurrentFiscalYear } from '@perdiemify/shared';

console.log('Perdiemify Worker starting...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Redis URL:', process.env.REDIS_URL ? 'configured' : 'not configured');

// --- Per Diem Sync Worker ---

const perdiemWorker = new Worker(
  'perdiem-sync',
  async (job) => {
    console.log(`[Worker] Processing perdiem-sync job: ${job.id}`);

    const fiscalYear = job.data?.fiscalYear || getCurrentFiscalYear();
    const result = await syncAllPerDiemRates(fiscalYear);

    console.log(`[Worker] Per diem sync complete: ${result.totalRatesInserted} rates, ${result.successStates}/${result.totalStates} states in ${(result.durationMs / 1000).toFixed(1)}s`);

    return {
      totalRatesInserted: result.totalRatesInserted,
      successStates: result.successStates,
      failedStates: result.failedStates,
      durationMs: result.durationMs,
    };
  },
  {
    connection: createWorkerConnection(),
    concurrency: 1,
  }
);

perdiemWorker.on('completed', (job) => {
  console.log(`[Worker] perdiem-sync job ${job.id} completed`);
});

perdiemWorker.on('failed', (job, err) => {
  console.error(`[Worker] perdiem-sync job ${job?.id} failed:`, err.message);
});

// --- Deal Alerts Worker ---

const dealAlertsWorker = new Worker(
  'deal-alerts',
  async (job) => {
    console.log(`[Worker] Processing deal-alerts job: ${job.id}`);

    const { deals } = job.data;
    if (!deals || !Array.isArray(deals) || deals.length === 0) {
      console.log('[Worker] No deals to alert about, skipping');
      return { sent: 0 };
    }

    const sent = await sendDealAlerts(deals);
    console.log(`[Worker] Deal alerts sent: ${sent} emails for ${deals.length} deals`);

    return { sent, dealsCount: deals.length };
  },
  {
    connection: createWorkerConnection(),
    concurrency: 1,
  }
);

dealAlertsWorker.on('completed', (job) => {
  console.log(`[Worker] deal-alerts job ${job.id} completed`);
});

dealAlertsWorker.on('failed', (job, err) => {
  console.error(`[Worker] deal-alerts job ${job?.id} failed:`, err.message);
});

// --- Discount Validation Worker ---

const discountValidationWorker = new Worker(
  'discount-validation',
  async (job) => {
    console.log(`[Worker] Processing discount-validation job: ${job.id}`);

    const [updatedCount, expiredCount] = await Promise.all([
      recalculateSuccessRates(),
      expireStaleCode(),
    ]);

    console.log(`[Worker] Discount validation: ${updatedCount} rates recalculated, ${expiredCount} stale codes expired`);

    return { successRatesUpdated: updatedCount, codesExpired: expiredCount };
  },
  {
    connection: createWorkerConnection(),
    concurrency: 1,
  }
);

discountValidationWorker.on('completed', (job) => {
  console.log(`[Worker] discount-validation job ${job.id} completed`);
});

discountValidationWorker.on('failed', (job, err) => {
  console.error(`[Worker] discount-validation job ${job?.id} failed:`, err.message);
});

// --- Loyalty Valuations Sync Worker ---
// Syncs curated point valuation data to loyalty_valuations table

const loyaltyValuationWorker = new Worker(
  'loyalty-valuations',
  async (job) => {
    console.log(`[Worker] Processing loyalty-valuations job: ${job.id}`);

    const result = await syncLoyaltyValuations();

    console.log(`[Worker] Loyalty valuations synced: ${result.synced} programs`);
    return result;
  },
  {
    connection: createWorkerConnection(),
    concurrency: 1,
  }
);

loyaltyValuationWorker.on('completed', (job) => {
  console.log(`[Worker] loyalty-valuations job ${job.id} completed`);
});

loyaltyValuationWorker.on('failed', (job, err) => {
  console.error(`[Worker] loyalty-valuations job ${job?.id} failed:`, err.message);
});

// --- Receipt OCR Worker ---

const ocrWorker = new Worker(
  'receipt-ocr',
  async (job) => {
    console.log(`[Worker] Processing receipt-ocr job: ${job.id}`);
    const { receiptId, storageKey } = job.data;

    try {
      // Load image from storage
      const storage = getStorage();
      const imageBuffer = await storage.getBuffer(storageKey);

      // Run OCR
      const result = await processReceiptImage(imageBuffer);

      // Update receipt record with extracted data
      await db
        .update(receipts)
        .set({
          ocrVendor: result.vendor,
          ocrAmount: result.amount != null ? String(result.amount) : null,
          ocrDate: result.date,
          ocrCategory: result.category,
          status: 'ready',
        })
        .where(eq(receipts.id, receiptId));

      console.log(`[Worker] OCR complete for receipt ${receiptId}: vendor=${result.vendor}, amount=${result.amount}, confidence=${result.confidence}%`);
      return result;
    } catch (err) {
      // Mark receipt as failed
      await db
        .update(receipts)
        .set({ status: 'failed' })
        .where(eq(receipts.id, receiptId))
        .catch(() => {});
      throw err;
    }
  },
  {
    connection: createWorkerConnection(),
    concurrency: 2,
  }
);

ocrWorker.on('completed', (job) => {
  console.log(`[Worker] receipt-ocr job ${job.id} completed`);
});

ocrWorker.on('failed', (job, err) => {
  console.error(`[Worker] receipt-ocr job ${job?.id} failed:`, err.message);
});

// --- Schedule repeatable jobs ---

async function setupSchedules() {
  try {
    // Per diem sync: run daily at 2:00 AM UTC
    await perdiemSyncQueue.upsertJobScheduler(
      'daily-perdiem-sync',
      { pattern: '0 2 * * *' },
      {
        name: 'daily-perdiem-sync',
        data: { fiscalYear: getCurrentFiscalYear() },
      }
    );
    console.log('[Worker] Scheduled: perdiem-sync (daily at 2 AM UTC)');

    // Discount validation: run every 6 hours
    await discountValidationQueue.upsertJobScheduler(
      'periodic-discount-validation',
      { pattern: '0 */6 * * *' },
      {
        name: 'periodic-discount-validation',
        data: {},
      }
    );
    console.log('[Worker] Scheduled: discount-validation (every 6 hours)');

    // Loyalty valuations sync: run weekly on Sundays at 3 AM UTC
    await loyaltyValuationQueue.upsertJobScheduler(
      'weekly-loyalty-valuations',
      { pattern: '0 3 * * 0' }, // Sunday 3 AM
      {
        name: 'weekly-loyalty-valuations',
        data: {},
      }
    );
    console.log('[Worker] Scheduled: loyalty-valuations (weekly Sunday 3 AM UTC)');

    // Trigger initial loyalty valuation sync
    await loyaltyValuationQueue.add('initial-loyalty-valuations', {});
    console.log('[Worker] Triggered initial loyalty valuations sync');

    // Check if rates need initial sync (table is empty)
    const rateCount = await getCachedRateCount();
    if (rateCount === 0) {
      console.log('[Worker] No cached rates found — triggering initial sync...');
      await perdiemSyncQueue.add('initial-perdiem-sync', {
        fiscalYear: getCurrentFiscalYear(),
      });
    } else {
      console.log(`[Worker] ${rateCount} cached per diem rates found for FY${getCurrentFiscalYear()}`);
    }

    console.log('[Worker] All schedules configured successfully');
  } catch (err) {
    console.error('[Worker] Failed to set up schedules:', err instanceof Error ? err.message : err);
  }
}

// Initialize schedules after a short delay (let Redis settle)
setTimeout(() => {
  setupSchedules();
}, 5_000);

// --- Graceful shutdown ---

async function shutdown(signal: string) {
  console.log(`Worker received ${signal}, shutting down...`);

  await Promise.allSettled([
    perdiemWorker.close(),
    dealAlertsWorker.close(),
    discountValidationWorker.close(),
    loyaltyValuationWorker.close(),
    ocrWorker.close(),
  ]);

  await shutdownOcr();
  console.log('Worker shut down cleanly.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

console.log('Worker is running — processing perdiem-sync, deal-alerts, discount-validation, loyalty-valuations, and receipt-ocr jobs.');
