import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { healthRouter } from './routes/health';
import { searchRouter } from './routes/search';
import { perdiemRouter } from './routes/perdiem';
import { tripsRouter } from './routes/trips';
import { billingRouter } from './routes/billing';
import { usersRouter } from './routes/users';
import { waitlistRouter } from './routes/waitlist';
import { webhooksRouter } from './routes/webhooks';
import { dealsRouter } from './routes/deals';
import { loyaltyRouter } from './routes/loyalty';
import { mealsRouter } from './routes/meals';
import { receiptsRouter } from './routes/receipts';
import { analyticsRouter } from './routes/analytics';

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(helmet());
// Support multiple CORS origins (comma-separated in env)
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());
app.use(cors({ origin: corsOrigins }));
app.use(morgan('combined'));

// Stripe webhook needs raw body for signature verification
// Must come before express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/search', searchRouter);
app.use('/api/perdiem', perdiemRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/billing', billingRouter);
app.use('/api/users', usersRouter);
app.use('/api/waitlist', waitlistRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/deals', dealsRouter);
app.use('/api/loyalty', loyaltyRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api/analytics', analyticsRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Perdiemify API running on port ${PORT}`);
  console.log(`Routes: health, search, perdiem, trips, billing, users, waitlist, webhooks, deals, loyalty, meals, receipts, analytics`);
});

export default app;
