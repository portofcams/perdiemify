/**
 * Itinerary Builder Service — Phase 5 Feature 3
 *
 * Given a trip, searches for the cheapest compliant hotel + flight + car,
 * ranks by total savings vs. per diem allowance, and returns a structured itinerary.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { trips } from '../db/schema';
import { searchHotels, searchFlights, type HotelSearchResult, type FlightSearchResult } from '../providers/amadeus';

export interface ItineraryHotel {
  name: string;
  pricePerNight: number;
  totalPrice: number;
  rating: number | null;
  roomType: string | null;
  savingsPerNight: number;
  loyaltyProgram: string | null;
  estimatedPoints: number;
}

export interface ItineraryFlight {
  airline: string;
  totalPrice: number;
  outboundDuration: string;
  outboundStops: number;
  departureTime: string;
  arrivalTime: string;
  cabin: string;
  seatsLeft: number;
}

export interface ItineraryBreakdown {
  date: string;
  lodgingAllowance: number;
  mieAllowance: number;
  isFirstOrLastDay: boolean;
}

export interface Itinerary {
  tripId: string;
  tripName: string;
  destination: string;
  hotel: ItineraryHotel | null;
  flight: ItineraryFlight | null;
  totalCost: number;
  totalAllowance: number;
  totalSavings: number;
  dailyBreakdown: ItineraryBreakdown[];
  nights: number;
  days: number;
}

const HOTEL_LOYALTY_MAP: Record<string, { program: string; pointsPerDollar: number }> = {
  'marriott': { program: 'Marriott Bonvoy', pointsPerDollar: 10 },
  'hilton': { program: 'Hilton Honors', pointsPerDollar: 10 },
  'hyatt': { program: 'World of Hyatt', pointsPerDollar: 5 },
  'ihg': { program: 'IHG One Rewards', pointsPerDollar: 10 },
  'wyndham': { program: 'Wyndham Rewards', pointsPerDollar: 10 },
  'best western': { program: 'Best Western Rewards', pointsPerDollar: 10 },
  'choice': { program: 'Choice Privileges', pointsPerDollar: 10 },
  'radisson': { program: 'Radisson Rewards', pointsPerDollar: 20 },
};

function detectLoyalty(hotelName: string): { program: string; pointsPerDollar: number } | null {
  const lower = hotelName.toLowerCase();
  for (const [key, val] of Object.entries(HOTEL_LOYALTY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

export async function buildItinerary(tripId: string): Promise<Itinerary> {
  // Load trip
  const [trip] = await db
    .select()
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);

  if (!trip) throw new Error('Trip not found');

  const lodgingRate = parseFloat(trip.lodgingRate);
  const mieRate = parseFloat(trip.mieRate);

  const startDate = new Date(trip.startDate);
  const endDate = new Date(trip.endDate);
  const nights = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const days = nights + 1; // include check-out day
  const firstLastDayMie = Math.round(mieRate * 0.75 * 100) / 100;

  // Build daily breakdown
  const dailyBreakdown: ItineraryBreakdown[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const isFirstOrLast = i === 0 || i === days - 1;
    dailyBreakdown.push({
      date: d.toISOString().split('T')[0],
      lodgingAllowance: i < nights ? lodgingRate : 0, // no lodging on checkout day
      mieAllowance: isFirstOrLast ? firstLastDayMie : mieRate,
      isFirstOrLastDay: isFirstOrLast,
    });
  }

  const totalLodgingAllowance = lodgingRate * nights;
  const totalMieAllowance = dailyBreakdown.reduce((sum, d) => sum + d.mieAllowance, 0);
  const totalAllowance = totalLodgingAllowance + totalMieAllowance;

  // Search hotels
  let bestHotel: ItineraryHotel | null = null;
  try {
    const hotels = await searchHotels({
      destination: trip.destination,
      destinationState: trip.destinationState || undefined,
      checkIn: trip.startDate,
      checkOut: trip.endDate,
      type: 'hotel',
    });

    // Find best hotel under per diem rate
    const underBudget = hotels.filter((h) => h.pricePerNight <= lodgingRate);
    const pick = underBudget.length > 0 ? underBudget[0] : hotels[0];

    if (pick) {
      const loyalty = detectLoyalty(pick.name);
      bestHotel = {
        name: pick.name,
        pricePerNight: pick.pricePerNight,
        totalPrice: pick.totalPrice,
        rating: pick.rating,
        roomType: pick.roomType,
        savingsPerNight: lodgingRate - pick.pricePerNight,
        loyaltyProgram: loyalty?.program || null,
        estimatedPoints: loyalty ? Math.round(pick.totalPrice * loyalty.pointsPerDollar) : 0,
      };
    }
  } catch (err: unknown) {
    console.warn('[Itinerary] Hotel search failed:', err instanceof Error ? err.message : err);
  }

  // Search flights (if origin is set)
  let bestFlight: ItineraryFlight | null = null;
  if (trip.origin) {
    try {
      const { flights } = await searchFlights({
        origin: trip.origin,
        destination: trip.destination,
        departureDate: trip.startDate,
        returnDate: trip.endDate,
      });

      if (flights.length > 0) {
        const pick = flights[0]; // cheapest
        bestFlight = {
          airline: pick.airline,
          totalPrice: pick.totalPrice,
          outboundDuration: pick.outboundDuration,
          outboundStops: pick.outboundStops,
          departureTime: pick.outboundDepartureTime,
          arrivalTime: pick.outboundArrivalTime,
          cabin: pick.cabin,
          seatsLeft: pick.seatsLeft,
        };
      }
    } catch (err: unknown) {
      console.warn('[Itinerary] Flight search failed:', err instanceof Error ? err.message : err);
    }
  }

  const totalCost = (bestHotel?.totalPrice || 0) + (bestFlight?.totalPrice || 0);
  const totalSavings = totalAllowance - totalCost;

  return {
    tripId: trip.id,
    tripName: trip.name,
    destination: trip.destination,
    hotel: bestHotel,
    flight: bestFlight,
    totalCost: Math.round(totalCost * 100) / 100,
    totalAllowance: Math.round(totalAllowance * 100) / 100,
    totalSavings: Math.round(totalSavings * 100) / 100,
    dailyBreakdown,
    nights,
    days,
  };
}
