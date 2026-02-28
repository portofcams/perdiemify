import { Queue } from 'bullmq';
import { getQueueConnection } from './connection';

/**
 * Queue definitions for all background jobs.
 *
 * Queues:
 *  - scraper      : Discount code scraping (every 4h)
 *  - perdiem-sync : Cache GSA per diem rates to DB (every 24h)
 *  - deal-alerts  : Send deal alert emails to Pro+ users (after scraper)
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
