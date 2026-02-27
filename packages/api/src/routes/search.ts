import { Router } from 'express';
import type { SearchParams, SearchResponse } from '@perdiemify/shared';
import { searchAndEnrich, searchAndEnrichFlights } from '../services/search-aggregator';
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

// POST /api/search/flights
searchRouter.post('/flights', async (req, res) => {
  try {
    const { origin, destination, destinationState, checkIn, checkOut, adults } = req.body;

    if (!origin || !destination || !checkIn) {
      return res.status(400).json({
        success: false,
        error: 'origin, destination, and checkIn are required',
      });
    }

    const params: SearchParams & { origin: string } = {
      origin,
      destination,
      destinationState,
      checkIn,
      checkOut: checkOut || '', // one-way if empty
      adults: adults || 1,
      type: 'flight',
    };

    // Check Redis cache
    const cacheParams = { origin, dest: destination, in: checkIn, out: checkOut || '', adults: adults || 1 };
    const cached = await getCached<SearchResponse>('search:flights', cacheParams);
    if (cached) {
      return res.json({ success: true, data: { ...cached, cached: true } });
    }

    const response = await searchAndEnrichFlights(params);

    if (response.results.length > 0) {
      await setCache('search:flights', cacheParams, response);
    }

    return res.json({ success: true, data: response });
  } catch (err) {
    console.error('Flight search error:', err);
    const message = err instanceof Error ? err.message : 'Flight search failed';
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/search/cars — mock results (no good free car API)
searchRouter.post('/cars', async (req, res) => {
  try {
    const { destination, destinationState, checkIn, checkOut } = req.body;

    if (!destination || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'destination, checkIn, and checkOut are required',
      });
    }

    // Car rentals don't have a free Amadeus API, so we return curated mock results
    // with realistic pricing. Affiliate links will connect to real providers in Day 6.
    const nights = Math.max(1, Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
    ));

    const carResults = [
      { name: 'Economy (Nissan Versa or similar)', provider: 'National', pricePerDay: 35, loyalty: 'National Emerald Club' },
      { name: 'Compact (Toyota Corolla or similar)', provider: 'Hertz', pricePerDay: 42, loyalty: 'Hertz Gold Plus' },
      { name: 'Midsize (Hyundai Sonata or similar)', provider: 'Enterprise', pricePerDay: 48, loyalty: 'Enterprise Plus' },
      { name: 'Full-size (Chevrolet Malibu or similar)', provider: 'Avis', pricePerDay: 55, loyalty: 'Avis Preferred' },
      { name: 'SUV (Ford Escape or similar)', provider: 'Budget', pricePerDay: 65, loyalty: null },
      { name: 'Minivan (Chrysler Pacifica or similar)', provider: 'National', pricePerDay: 72, loyalty: 'National Emerald Club' },
    ].map((car) => ({
      id: crypto.randomUUID(),
      type: 'car' as const,
      provider: 'mock',
      providerName: car.provider,
      name: car.name,
      description: `${car.provider} — ${nights} day rental, unlimited miles`,
      price: car.pricePerDay * nights,
      pricePerNight: car.pricePerDay,
      currency: 'USD',
      perDiemDelta: 0,
      perDiemBadge: 'near' as const,
      affiliateLink: '',
      imageUrl: null,
      rating: null,
      loyaltyProgram: car.loyalty,
      estimatedPoints: car.loyalty ? Math.round(car.pricePerDay * nights * 5) : null,
      discountCodes: [],
      amenities: ['Unlimited miles', 'Free cancellation'],
      location: `${destination}${destinationState ? ', ' + destinationState : ''} Airport`,
    }));

    return res.json({
      success: true,
      data: {
        results: carResults,
        perDiemRates: { lodgingRate: 0, mieRate: 0, firstLastDayRate: 0, totalAllowance: 0, totalLodgingAllowance: 0, totalMieAllowance: 0, nights, days: nights + 1 },
        savingsMax: carResults[0] || null,
        smartValue: carResults[2] || null,
        cached: false,
        searchId: crypto.randomUUID(),
      },
    });
  } catch (err) {
    console.error('Car search error:', err);
    const message = err instanceof Error ? err.message : 'Car search failed';
    return res.status(500).json({ success: false, error: message });
  }
});
