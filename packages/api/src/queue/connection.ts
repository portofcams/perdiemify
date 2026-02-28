/**
 * Shared Redis connection for BullMQ queues and workers.
 *
 * IMPORTANT: We use ConnectionOptions (plain object) instead of IORedis instances
 * to avoid version mismatches between top-level ioredis and BullMQ's bundled ioredis.
 * BullMQ will create its own IORedis instances from these options.
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379'),
      ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

const redisOpts = parseRedisUrl(REDIS_URL);

/**
 * Returns BullMQ-compatible connection options (plain object).
 * BullMQ creates its own IORedis instances internally.
 */
export function getQueueConnection() {
  return {
    host: redisOpts.host,
    port: redisOpts.port,
    ...(redisOpts.password ? { password: redisOpts.password } : {}),
    maxRetriesPerRequest: null as null, // BullMQ requirement
    enableReadyCheck: false,
    connectTimeout: 10_000,
  };
}

/**
 * Workers need their own connection config (BullMQ best practice).
 * Returns fresh options each time so BullMQ creates separate connections.
 */
export function createWorkerConnection() {
  return getQueueConnection();
}
