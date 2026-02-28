import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  let dbStatus: 'ok' | 'error' = 'error';
  let dbLatencyMs = 0;

  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    dbLatencyMs = Date.now() - start;
    dbStatus = 'ok';
  } catch (err) {
    console.error('DB health check failed:', err);
  }

  const overall = dbStatus === 'ok' ? 'ok' : 'degraded';

  res.status(overall === 'ok' ? 200 : 503).json({
    success: true,
    data: {
      status: overall,
      service: 'perdiemify-api',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: dbStatus, latencyMs: dbLatencyMs },
      },
    },
  });
});
