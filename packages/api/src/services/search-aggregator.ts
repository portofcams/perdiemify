import type { SearchParams, SearchResult, SearchResponse, PerDiemRates } from '@perdiemify/shared';
import { searchHotels, searchFlights, type HotelSearchResult, type FlightSearchResult } from '../providers/amadeus';
import { calculatePerDiem, getPerDiemBadge, calculateDelta } from './perdiem-calculator';

function generateId(): string {
  return crypto.randomUUID();
}

function enrichHotelResult(
  hotel: HotelSearchResult,
  perDiem: PerDiemRates
): SearchResult {
  const totalCost = hotel.pricePerNight * perDiem.nights;
  const delta = calculateDelta(totalCost, perDiem.totalLodgingAllowance);
  const badge = getPerDiemBadge(hotel.pricePerNight, perDiem.lodgingRate);

  return {
    id: generateId(),
    type: 'hotel',
    provider: 'amadeus',
    providerName: 'Amadeus',
    name: formatHotelName(hotel.name),
    description: hotel.roomDescription,
    price: totalCost,
    pricePerNight: hotel.pricePerNight,
    currency: hotel.currency,
    perDiemDelta: delta,
    perDiemBadge: badge,
    affiliateLink: '', // Populated in Phase 1 Day 6
    imageUrl: null,
    rating: hotel.rating,
    loyaltyProgram: detectLoyaltyProgram(hotel.name),
    estimatedPoints: estimatePoints(hotel.name, totalCost),
    discountCodes: [],
    amenities: hotel.roomType ? [hotel.roomType] : [],
    location: null,
  };
}

function formatHotelName(name: string): string {
  // Amadeus returns names in ALL CAPS — convert to title case
  return name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bIhg\b/gi, 'IHG')
    .replace(/\bInn\b/gi, 'Inn');
}

function detectLoyaltyProgram(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes('marriott') || lower.includes('courtyard') || lower.includes('fairfield') || lower.includes('residence inn') || lower.includes('springhill'))
    return 'Marriott Bonvoy';
  if (lower.includes('hilton') || lower.includes('hampton') || lower.includes('doubletree') || lower.includes('garden inn') || lower.includes('homewood'))
    return 'Hilton Honors';
  if (lower.includes('ihg') || lower.includes('holiday inn') || lower.includes('crowne plaza') || lower.includes('intercontinental'))
    return 'IHG One Rewards';
  if (lower.includes('hyatt'))
    return 'World of Hyatt';
  if (lower.includes('wyndham') || lower.includes('days inn') || lower.includes('super 8') || lower.includes('la quinta'))
    return 'Wyndham Rewards';
  if (lower.includes('best western'))
    return 'Best Western Rewards';
  if (lower.includes('choice') || lower.includes('comfort') || lower.includes('quality inn') || lower.includes('econo lodge'))
    return 'Choice Privileges';
  return null;
}

function estimatePoints(name: string, totalCost: number): number | null {
  // Rough points-per-dollar estimates
  const program = detectLoyaltyProgram(name);
  if (!program) return null;

  const rates: Record<string, number> = {
    'Marriott Bonvoy': 10,       // ~10 pts/$
    'Hilton Honors': 10,         // ~10 pts/$
    'IHG One Rewards': 10,       // ~10 pts/$
    'World of Hyatt': 5,         // ~5 pts/$
    'Wyndham Rewards': 10,       // ~10 pts/$
    'Best Western Rewards': 10,  // ~10 pts/$
    'Choice Privileges': 10,     // ~10 pts/$
  };

  const rate = rates[program] || 10;
  return Math.round(totalCost * rate);
}

function pickSavingsMax(results: SearchResult[]): SearchResult | null {
  if (results.length === 0) return null;
  // Highest positive delta (most savings)
  const underBudget = results.filter((r) => r.perDiemDelta > 0);
  if (underBudget.length === 0) return results[0]; // cheapest if all over
  return underBudget.reduce((best, r) => r.perDiemDelta > best.perDiemDelta ? r : best);
}

function pickSmartValue(results: SearchResult[]): SearchResult | null {
  if (results.length === 0) return null;
  // Best balance of savings + rating
  const scored = results
    .filter((r) => r.perDiemDelta > 0 && r.rating !== null)
    .map((r) => ({
      result: r,
      score: r.perDiemDelta * 0.4 + (r.rating || 3) * 20,
    }));

  if (scored.length === 0) {
    // Fallback: just pick second-cheapest under budget or cheapest
    const underBudget = results.filter((r) => r.perDiemDelta > 0);
    return underBudget[1] || underBudget[0] || results[0];
  }

  return scored.reduce((best, s) => s.score > best.score ? s : best).result;
}

export async function searchAndEnrich(
  params: SearchParams
): Promise<SearchResponse> {
  // Step 1: Calculate per diem allowance for this trip
  const perDiem = await calculatePerDiem({
    city: params.destination,
    state: params.destinationState || 'DC',
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    perDiemSource: 'gsa',
  });

  // Step 2: Search hotels via Amadeus
  let hotelResults: HotelSearchResult[];
  try {
    hotelResults = await searchHotels(params);
  } catch (err) {
    console.error('Amadeus hotel search failed:', err);
    hotelResults = [];
  }

  // Step 3: Enrich each result with per diem data
  const results = hotelResults.map((h) => enrichHotelResult(h, perDiem));

  // Step 4: Pick Savings Max and Smart Value
  const savingsMax = pickSavingsMax(results);
  const smartValue = pickSmartValue(results);

  // Avoid duplicate if same hotel is both
  const smartValueFinal =
    smartValue && savingsMax && smartValue.id === savingsMax.id
      ? results.find((r) => r.id !== savingsMax.id && r.perDiemDelta > 0) || smartValue
      : smartValue;

  return {
    results,
    perDiemRates: perDiem,
    savingsMax,
    smartValue: smartValueFinal,
    cached: false,
    searchId: generateId(),
  };
}

// --- Flight search ---

function detectAirlineLoyalty(airline: string): string | null {
  const lower = airline.toLowerCase();
  if (lower.includes('delta')) return 'Delta SkyMiles';
  if (lower.includes('united')) return 'United MileagePlus';
  if (lower.includes('american')) return 'American AAdvantage';
  if (lower.includes('southwest')) return 'Southwest Rapid Rewards';
  if (lower.includes('jetblue')) return 'JetBlue TrueBlue';
  if (lower.includes('alaska')) return 'Alaska Mileage Plan';
  if (lower.includes('frontier') || lower.includes('spirit') || lower.includes('allegiant')) return null;
  return null;
}

function estimateFlightMiles(airline: string, price: number): number | null {
  const program = detectAirlineLoyalty(airline);
  if (!program) return null;
  // Rough: ~5 miles per dollar spent on base fares
  return Math.round(price * 5);
}

function formatDuration(isoDuration: string): string {
  // PT2H30M -> 2h 30m
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return isoDuration;
  const h = match[1] ? `${match[1]}h` : '';
  const m = match[2] ? ` ${match[2]}m` : '';
  return `${h}${m}`.trim();
}

function enrichFlightResult(flight: FlightSearchResult, perDiem: PerDiemRates): SearchResult {
  // For flights, per diem delta = total M&IE allowance - flight cost (conceptually: savings on transport)
  // We compare flight cost against a reasonable budget (not lodging). Show delta as info only.
  const delta = 0; // Flights don't have a per diem "rate" — delta shown as neutral
  const stopsLabel = flight.outboundStops === 0 ? 'Nonstop' : `${flight.outboundStops} stop${flight.outboundStops > 1 ? 's' : ''}`;

  return {
    id: generateId(),
    type: 'flight',
    provider: 'amadeus',
    providerName: flight.airline,
    name: `${flight.airline} — ${stopsLabel}`,
    description: `${formatDuration(flight.outboundDuration)}${flight.returnDuration ? ' | Return: ' + formatDuration(flight.returnDuration) : ' one-way'}`,
    price: flight.totalPrice,
    currency: flight.currency,
    perDiemDelta: delta,
    perDiemBadge: 'near', // Flights are informational, not rated against per diem lodging
    affiliateLink: '',
    imageUrl: null,
    rating: null,
    loyaltyProgram: detectAirlineLoyalty(flight.airline),
    estimatedPoints: estimateFlightMiles(flight.airline, flight.totalPrice),
    discountCodes: [],
    amenities: [flight.cabin, stopsLabel, `${flight.seatsLeft} seats left`],
    location: null,
  };
}

export async function searchAndEnrichFlights(
  params: SearchParams & { origin: string }
): Promise<SearchResponse> {
  const perDiem = await calculatePerDiem({
    city: params.destination,
    state: params.destinationState || 'DC',
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    perDiemSource: 'gsa',
  });

  let flightResults: FlightSearchResult[];
  try {
    const { flights } = await searchFlights({
      origin: params.origin,
      destination: params.destination,
      departureDate: params.checkIn,
      returnDate: params.checkOut,
      adults: params.adults,
    });
    flightResults = flights;
  } catch (err) {
    console.error('Amadeus flight search failed:', err);
    flightResults = [];
  }

  const results = flightResults.map((f) => enrichFlightResult(f, perDiem));

  // For flights: cheapest = savingsMax, best nonstop = smartValue
  const savingsMax = results.length > 0 ? results[0] : null; // already sorted by price
  const nonstop = results.find((r) => r.amenities.includes('Nonstop'));
  const smartValue = nonstop || results[1] || savingsMax;

  return {
    results,
    perDiemRates: perDiem,
    savingsMax,
    smartValue: smartValue && savingsMax && smartValue.id === savingsMax.id ? (results[1] || smartValue) : smartValue,
    cached: false,
    searchId: generateId(),
  };
}
