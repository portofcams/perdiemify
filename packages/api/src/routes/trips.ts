import { Router } from 'express';

export const tripsRouter = Router();

// CRUD placeholders for Day 7
tripsRouter.get('/', (_req, res) => {
  res.json({ success: true, data: { trips: [], message: 'Trips API coming Day 7' } });
});
