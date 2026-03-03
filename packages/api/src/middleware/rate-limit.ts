import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedis } from '../utils/redis';

function createStore() {
  const redis = getRedis();
  if (!redis) return undefined; // falls back to in-memory
  return new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...args) as Promise<any>,
  });
}

/** Global rate limit: 100 requests per minute per IP */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createStore(),
  message: { success: false, error: 'Too many requests. Please try again later.' },
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});

/** Strict rate limit for auth-sensitive endpoints: 10 per minute */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createStore(),
  message: { success: false, error: 'Too many authentication attempts. Please wait.' },
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});

/** Waitlist/signup: 5 per minute */
export const signupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createStore(),
  message: { success: false, error: 'Too many signup attempts. Please wait.' },
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
});
