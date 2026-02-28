import { Queue } from 'bullmq';
import { getQueueConnection } from './connection';

/**
 * Queue definitions for all background jobs.
 *
 * Queues:
 *  - scraper             : Discount code scraping (every 4h)
 *  - perdiem-sync        : Cache GSA per diem rates to DB (daily)
 *  - deal-alerts         : Send deal alert emails to Pro+ users
 *  - discount-validation : Recalculate success rates & expire stale codes (every 6h)
 *  - loyalty-valuations  : Sync loyalty program valuations (weekly)
 *  - receipt-ocr         : Process receipt images via Tesseract.js OCR
 */

export const scraperQueue = new Queue('scraper', {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

export const perdiemSyncQueue = new Queue('perdiem-sync', {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 20 },
    removeOnFail: { count: 50 },
  },
});

export const dealAlertsQueue = new Queue('deal-alerts', {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 60_000 },
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 50 },
  },
});

export const discountValidationQueue = new Queue('discount-validation', {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 30_000 },
    removeOnComplete: { count: 20 },
    removeOnFail: { count: 30 },
  },
});

export const loyaltyValuationQueue = new Queue('loyalty-valuations', {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 30_000 },
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 20 },
  },
});

export const ocrQueue = new Queue('receipt-ocr', {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});
