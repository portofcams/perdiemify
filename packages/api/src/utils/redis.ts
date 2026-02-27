import Redis from 'ioredis';
import { CACHE_TTL } from '@perdiemify/shared';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      console.warn('Redis connection error (caching disabled):', err.message);
    });

    redis.connect().catch(() => {
      // Silently fail — app works without Redis
      redis = null;
    });

    return redis;
  } catch {
    return null;
  }
}

function buildCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return `perdiemify:${prefix}:${sorted}`;
}

export async function getCached<T>(prefix: string, params: Record<string, unknown>): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;

  try {
    const key = buildCacheKey(prefix, params);
    const cached = await client.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch {
    return null;
  }
}

export async function setCache<T>(
  prefix: string,
  params: Record<string, unknown>,
  data: T,
  ttlSeconds?: number
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    const key = buildCacheKey(prefix, params);
    const ttl = ttlSeconds ?? CACHE_TTL.searchResults;
    await client.set(key, JSON.stringify(data), 'EX', ttl);
  } catch {
    // Cache write failure is non-fatal
  }
}
