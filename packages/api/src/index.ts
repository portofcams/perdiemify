import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { healthRouter } from './routes/health';
import { searchRouter } from './routes/search';
import { perdiemRouter } from './routes/perdiem';
import { tripsRouter } from './routes/trips';

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(morgan('combined'));
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/search', searchRouter);
app.use('/api/perdiem', perdiemRouter);
app.use('/api/trips', tripsRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Perdiemify API running on port ${PORT}`);
});

export default app;
