import type { SearchParams, SearchResult, SearchResponse, PerDiemRates } from '@perdiemify/shared';
import { searchHotels, type HotelSearchResult } from '../providers/amadeus';
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
