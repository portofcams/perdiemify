import { Router } from 'express';
import { fetchGSARates } from '../services/gsa-rates';
import { calculatePerDiem } from '../services/perdiem-calculator';
import { getCachedRateCount } from '../services/gsa-rate-sync';
import { perdiemSyncQueue, oconusSyncQueue } from '../queue/queues';
import { getCurrentFiscalYear } from '@perdiemify/shared';
import { getOconusRate, listOconusCountries, listOconusLocations } from '../services/state-dept-rates';

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

// ─── OCONUS (International) Per Diem Endpoints ─────────────────

// GET /api/perdiem/oconus/countries — List countries with rates
perdiemRouter.get('/oconus/countries', async (req, res) => {
  try {
    const fiscalYear = req.query.year ? parseInt(req.query.year as string, 10) : getCurrentFiscalYear();
    const countries = await listOconusCountries(fiscalYear);
    return res.json({ success: true, data: countries });
  } catch (err) {
    console.error('OCONUS countries error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch OCONUS countries' });
  }
});

// GET /api/perdiem/oconus/rates?country=DE&location=Berlin&year=2026
perdiemRouter.get('/oconus/rates', async (req, res) => {
  try {
    const { country, location, year } = req.query;

    if (!country) {
      return res.status(400).json({ success: false, error: 'country query parameter is required (ISO 2-letter code)' });
    }

    const fiscalYear = year ? parseInt(year as string, 10) : getCurrentFiscalYear();

    if (location) {
      const rate = await getOconusRate(country as string, location as string, fiscalYear);
      if (!rate) {
        return res.status(404).json({ success: false, error: `No OCONUS rate found for ${country}/${location} (FY${fiscalYear})` });
      }
      return res.json({ success: true, data: rate });
    }

    // No location specified — return all locations for the country
    const locations = await listOconusLocations(country as string, fiscalYear);
    return res.json({ success: true, data: locations });
  } catch (err) {
    console.error('OCONUS rates error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch OCONUS rates' });
  }
});

// POST /api/perdiem/oconus/calculate — Calculate international per diem
perdiemRouter.post('/oconus/calculate', async (req, res) => {
  try {
    const { countryCode, location, checkIn, checkOut } = req.body;

    if (!countryCode || !location || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'countryCode, location, checkIn, and checkOut are required',
      });
    }

    const fiscalYear = getCurrentFiscalYear();
    const rate = await getOconusRate(countryCode, location, fiscalYear);

    if (!rate) {
      return res.status(404).json({
        success: false,
        error: `No OCONUS rate found for ${countryCode}/${location}`,
      });
    }

    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const nights = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const days = nights + 1;
    const firstLastDayMie = Math.round(rate.mieRate * 0.75 * 100) / 100;

    const totalLodging = rate.lodgingRate * nights;
    const totalMie = firstLastDayMie * 2 + rate.mieRate * Math.max(0, days - 2);
    const totalAllowance = Math.round((totalLodging + totalMie) * 100) / 100;

    return res.json({
      success: true,
      data: {
        country: rate.country,
        countryCode: rate.countryCode,
        location: rate.location,
        lodgingRate: rate.lodgingRate,
        mieRate: rate.mieRate,
        firstLastDayRate: firstLastDayMie,
        nights,
        days,
        totalLodgingAllowance: totalLodging,
        totalMieAllowance: Math.round(totalMie * 100) / 100,
        totalAllowance,
        season: rate.season,
        fiscalYear,
        summary: `$${rate.lodgingRate}/night lodging + $${rate.mieRate}/day M&IE`,
        friendlyTotal: `Your ${days}-day international trip allowance: $${totalAllowance.toLocaleString()}`,
      },
    });
  } catch (err) {
    console.error('OCONUS calculate error:', err);
    return res.status(500).json({ success: false, error: 'Failed to calculate OCONUS per diem' });
  }
});

// POST /api/perdiem/oconus/sync — Internal: trigger OCONUS rate sync
perdiemRouter.post('/oconus/sync', async (req, res) => {
  try {
    const apiKey = req.headers['x-internal-key'];
    if (apiKey !== (process.env.INTERNAL_API_KEY || 'perdiemify-internal')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const fiscalYear = req.body.fiscalYear || getCurrentFiscalYear();
    await oconusSyncQueue.add('manual-oconus-sync', { fiscalYear });

    return res.json({
      success: true,
      message: `OCONUS sync job queued for FY${fiscalYear}`,
    });
  } catch (err) {
    console.error('OCONUS sync trigger error:', err);
    return res.status(500).json({ success: false, error: 'Failed to trigger OCONUS sync' });
  }
});
