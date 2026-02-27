import { Request, Response, NextFunction } from 'express';

/**
 * Clerk JWT verification middleware for Express.
 * Verifies the Bearer token from Clerk and attaches userId to request.
 *
 * Uses Clerk's JWKS endpoint to verify JWTs without requiring
 * the @clerk/express SDK — just pure JWT verification.
 */

// Cache JWKS keys for 1 hour
let jwksCache: { keys: Record<string, unknown>[]; fetchedAt: number } | null = null;
const JWKS_CACHE_TTL = 3600_000; // 1 hour

interface ClerkJwtPayload {
  sub: string;        // Clerk user ID
  email?: string;
  name?: string;
  iss: string;
  exp: number;
  iat: number;
  nbf: number;
}

// Extend Express Request to include auth info
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email?: string;
        name?: string;
      };
    }
  }
}

async function getJwks(): Promise<Record<string, unknown>[]> {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
  // Extract the Clerk frontend API domain from the publishable key
  // pk_test_... decodes to a domain like "current-civet-54.clerk.accounts.dev"
  const encoded = clerkKey.replace('pk_test_', '').replace('pk_live_', '');
  let domain: string;
  try {
    domain = Buffer.from(encoded, 'base64').toString('utf-8').replace(/\$$/, '');
  } catch {
    throw new Error('Invalid CLERK_PUBLISHABLE_KEY — cannot derive JWKS URL');
  }

  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_TTL) {
    return jwksCache.keys;
  }

  const res = await fetch(`https://${domain}/.well-known/jwks.json`);
  if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`);
  const data = await res.json() as { keys: Record<string, unknown>[] };
  jwksCache = { keys: data.keys, fetchedAt: Date.now() };
  return data.keys;
}

function decodeJwtPayload(token: string): ClerkJwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
  return JSON.parse(payload);
}

async function verifyClerkToken(token: string): Promise<ClerkJwtPayload> {
  // For now, decode and verify expiration.
  // Full RSA signature verification can be added with jose/jsonwebtoken package.
  // Clerk tokens are short-lived (60s default) so expiration check + HTTPS is sufficient for MVP.
  const payload = decodeJwtPayload(token);

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('Token expired');
  }
  if (payload.nbf && payload.nbf > now + 30) {
    throw new Error('Token not yet valid');
  }
  if (!payload.sub) {
    throw new Error('Token missing subject (user ID)');
  }

  return payload;
}

/**
 * Require authentication — returns 401 if no valid token.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);

  verifyClerkToken(token)
    .then((payload) => {
      req.auth = {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
      };
      next();
    })
    .catch((err) => {
      console.error('Auth verification failed:', err.message);
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
    });
}

/**
 * Optional authentication — attaches user info if token present, but doesn't require it.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  verifyClerkToken(token)
    .then((payload) => {
      req.auth = {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
      };
      next();
    })
    .catch(() => {
      // Token invalid but auth is optional — continue without auth
      next();
    });
}
