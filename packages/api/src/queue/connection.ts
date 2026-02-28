import IORedis from 'ioredis';

/**
 * Shared Redis connection for BullMQ queues and workers.
 *
 * BullMQ requires ioredis, not generic Redis clients.
 * We parse REDIS_URL the same way the rest of the app does.
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function createConnection(): IORedis {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // BullMQ requirement
    enableReadyCheck: false,
    connectTimeout: 10_000,
    retryStrategy(times: number) {
      return Math.min(times * 500, 5000);
    },
  });
}

// Export a lazy singleton for the queue side
let _connection: IORedis | null = null;
export function getQueueConnection(): IORedis {
  if (!_connection) {
    _connection = createConnection();
  }
  return _connection;
}

// Workers need their own connection (BullMQ best practice)
export function createWorkerConnection(): IORedis {
  return createConnection();
}
