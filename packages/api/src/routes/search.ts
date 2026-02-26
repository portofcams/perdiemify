import { Router } from 'express';

export const searchRouter = Router();

// POST /api/search/hotels — placeholder for Day 4
searchRouter.post('/hotels', (_req, res) => {
  res.json({
    success: true,
    data: { results: [], message: 'Hotel search coming Day 4' },
  });
});

// POST /api/search/flights — placeholder for Day 5
searchRouter.post('/flights', (_req, res) => {
  res.json({
    success: true,
    data: { results: [], message: 'Flight search coming Day 5' },
  });
});

// POST /api/search/cars — placeholder for Day 5
searchRouter.post('/cars', (_req, res) => {
  res.json({
    success: true,
    data: { results: [], message: 'Car search coming Day 5' },
  });
});
