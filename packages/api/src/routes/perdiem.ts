import { Router } from 'express';
import { fetchGSARates } from '../services/gsa-rates';
import { calculatePerDiem } from '../services/perdiem-calculator';
import { getCachedRateCount } from '../services/gsa-rate-sync';
import { perdiemSyncQueue } from '../queue/queues';
import { getCurrentFiscalYear } from '@perdiemify/shared';

export const perdiemRouter = Router();

// GET /api/perdiem/rates?city=Denver&state=CO&year=2026
perdiemRouter.get('/rates', async (req, res) => {
  try {
    const { city, state, year } = req.query;

    if (!city || !state) {
      return res.status(400).json({
        success: false,
        error: 'city and state are required query parameters',
      });
    }

    const fiscalYear = year ? parseInt(year as string, 10) : getCurrentFiscalYear();
    const rates = await fetchGSARates(city as string, state as string, fiscalYear);

    if (rates.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No per diem rates found for ${city}, ${state} (FY${fiscalYear})`,
      });
    }

    // Deduplicate: return one entry per city/county with all monthly rates
    const grouped = new Map<string, { city: string; county: string | null; mieRate: number; monthlyLodging: Record<number, number> }>();

    for (const rate of rates) {
      const key = `${rate.city}-${rate.county}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          city: rate.city,
          county: rate.county,
          mieRate: rate.mieRate,
          monthlyLodging: {},
        });
      }
      const entry = grouped.get(key)!;
      if (rate.month) {
        entry.monthlyLodging[rate.month] = rate.lodgingRate;
      }
    }

    const results = Array.from(grouped.values()).map((entry) => ({
      city: entry.city,
      county: entry.county,
      mieRate: entry.mieRate,
      monthlyLodging: entry.monthlyLodging,
      fiscalYear,
      state: state as string,
    }));

    return res.json({ success: true, data: results });
  } catch (err) {
    console.error('Per diem rates error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch per diem rates' });
  }
});

// POST /api/perdiem/calculate
perdiemRouter.post('/calculate', async (req, res) => {
  try {
    const { city, state, checkIn, checkOut, perDiemSource, customLodgingRate, customMieRate } = req.body;

    if (!city || !state || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'city, state, checkIn, and checkOut are required',
      });
    }

    const result = await calculatePerDiem({
      city,
      state,
      checkIn,
      checkOut,
      perDiemSource: perDiemSource || 'gsa',
      customLodgingRate,
      customMieRate,
    });

    return res.json({
      success: true,
      data: {
        ...result,
        summary: `$${result.lodgingRate}/night lodging + $${result.mieRate}/day M&IE`,
        friendlyTotal: `Your ${result.days}-day trip allowance: $${result.totalAllowance.toLocaleString()}`,
      },
    });
  } catch (err) {
    console.error('Per diem calculation error:', err);
    return res.status(500).json({ success: false, error: 'Failed to calculate per diem' });
  }
});

// POST /api/perdiem/sync — Internal: trigger a full per diem rate sync
perdiemRouter.post('/sync', async (req, res) => {
  try {
    const apiKey = req.headers['x-internal-key'];
    if (apiKey !== (process.env.INTERNAL_API_KEY || 'perdiemify-internal')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const fiscalYear = req.body.fiscalYear || getCurrentFiscalYear();

    await perdiemSyncQueue.add('manual-perdiem-sync', { fiscalYear });

    return res.json({
      success: true,
      message: `Per diem sync job queued for FY${fiscalYear}`,
    });
  } catch (err) {
    console.error('Per diem sync trigger error:', err);
    return res.status(500).json({ success: false, error: 'Failed to trigger sync' });
  }
});

// GET /api/perdiem/cache-status — Check how many rates are cached
perdiemRouter.get('/cache-status', async (req, res) => {
  try {
    const fiscalYear = req.query.year ? parseInt(req.query.year as string, 10) : getCurrentFiscalYear();
    const count = await getCachedRateCount(fiscalYear);

    return res.json({
      success: true,
      data: {
        fiscalYear,
        cachedRates: count,
        isCached: count > 0,
      },
    });
  } catch (err) {
    console.error('Cache status error:', err);
    return res.status(500).json({ success: false, error: 'Failed to check cache status' });
  }
});
