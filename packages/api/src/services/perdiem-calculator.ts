import { FIRST_LAST_DAY_RATE, PERDIEM_BADGE_THRESHOLDS } from '@perdiemify/shared';
import type { PerDiemRates, PerDiemBadge } from '@perdiemify/shared';
import { fetchGSARateForDate } from './gsa-rates';

interface CalcInput {
  city: string;
  state: string;
  checkIn: string;
  checkOut: string;
  perDiemSource: 'gsa' | 'jtr' | 'corporate' | 'custom';
  customLodgingRate?: number;
  customMieRate?: number;
}

export async function calculatePerDiem(input: CalcInput): Promise<PerDiemRates> {
  const checkIn = new Date(input.checkIn);
  const checkOut = new Date(input.checkOut);

  // Calculate nights and days
  const nights = Math.ceil(
    (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
  );
  const days = nights + 1; // includes travel days

  let lodgingRate: number;
  let mieRate: number;

  if (input.perDiemSource === 'custom' && input.customLodgingRate && input.customMieRate) {
    lodgingRate = input.customLodgingRate;
    mieRate = input.customMieRate;
  } else {
    // Fetch GSA rates for check-in date (rates may vary by month)
    const gsaRate = await fetchGSARateForDate(input.city, input.state, input.checkIn);

    if (!gsaRate) {
      // Fall back to standard CONUS rate
      lodgingRate = 107; // FY2026 standard
      mieRate = 68;      // FY2026 standard
    } else {
      lodgingRate = gsaRate.lodgingRate;
      mieRate = gsaRate.mieRate;
    }
  }

  // First and last day: 75% M&IE
  const firstLastDayRate = Math.round(mieRate * FIRST_LAST_DAY_RATE * 100) / 100;

  // Total lodging allowance = rate × nights
  const totalLodgingAllowance = lodgingRate * nights;

  // Total M&IE = first day (75%) + middle days (100%) + last day (75%)
  const middleDays = Math.max(0, days - 2);
  const totalMieAllowance =
    firstLastDayRate + // first day
    mieRate * middleDays + // middle days
    (days > 1 ? firstLastDayRate : 0); // last day (only if multi-day)

  const totalAllowance = totalLodgingAllowance + totalMieAllowance;

  return {
    lodgingRate,
    mieRate,
    firstLastDayRate,
    totalAllowance,
    totalLodgingAllowance,
    totalMieAllowance,
    nights,
    days,
  };
}

export function getPerDiemBadge(price: number, allowance: number): PerDiemBadge {
  const ratio = price / allowance;

  if (ratio <= PERDIEM_BADGE_THRESHOLDS.under) return 'under';
  if (ratio <= PERDIEM_BADGE_THRESHOLDS.near) return 'near';
  return 'over';
}

export function calculateDelta(price: number, allowance: number): number {
  return Math.round((allowance - price) * 100) / 100;
}
