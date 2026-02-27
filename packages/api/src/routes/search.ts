import { Router } from 'express';
import type { SearchParams, SearchResponse } from '@perdiemify/shared';
import { searchAndEnrich } from '../services/search-aggregator';
import { getCached, setCache } from '../utils/redis';

export const searchRouter = Router();

// POST /api/search/hotels
searchRouter.post('/hotels', async (req, res) => {
  try {
    const { destination, destinationState, checkIn, checkOut, adults } = req.body;

    if (!destination || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'destination, checkIn, and checkOut are required',
      });
    }

    const params: SearchParams = {
      destination,
      destinationState,
      checkIn,
      checkOut,
      adults: adults || 1,
      type: 'hotel',
    };

    // Check Redis cache first
    const cacheParams = { dest: destination, state: destinationState, in: checkIn, out: checkOut, adults: adults || 1 };
    const cached = await getCached<SearchResponse>('search:hotels', cacheParams);
    if (cached) {
      return res.json({ success: true, data: { ...cached, cached: true } });
    }

    const response = await searchAndEnrich(params);

    // Cache results (15 min TTL)
    if (response.results.length > 0) {
      await setCache('search:hotels', cacheParams, response);
    }

    return res.json({ success: true, data: response });
  } catch (err) {
    console.error('Hotel search error:', err);
    const message = err instanceof Error ? err.message : 'Hotel search failed';
    return res.status(500).json({ success: false, error: message });
  }
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
