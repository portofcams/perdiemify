import 'dotenv/config';
import { Worker } from 'bullmq';
import { createWorkerConnection } from './connection';
import { perdiemSyncQueue, discountValidationQueue } from './queues';
import { syncAllPerDiemRates, getCachedRateCount } from '../services/gsa-rate-sync';
import { sendDealAlerts } from '../services/deal-alerts';
import { recalculateSuccessRates, expireStaleCode } from '../services/discount-engine';
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
// Recalculates success_rate from community votes, auto-expires low-rated codes

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
  ]);

  console.log('Worker shut down cleanly.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

console.log('Worker is running — processing perdiem-sync, deal-alerts, and discount-validation jobs.');
