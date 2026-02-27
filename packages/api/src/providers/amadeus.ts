import type { SearchParams } from '@perdiemify/shared';

const AMADEUS_BASE = process.env.NODE_ENV === 'production'
  ? 'https://api.amadeus.com'
  : 'https://test.api.amadeus.com';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const key = process.env.AMADEUS_API_KEY;
  const secret = process.env.AMADEUS_API_SECRET;

  if (!key || !secret) {
    throw new Error('AMADEUS_API_KEY and AMADEUS_API_SECRET are required');
  }

  const res = await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: key,
      client_secret: secret,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Amadeus OAuth error ${res.status}: ${body}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

async function amadeusGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${AMADEUS_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Amadeus API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// City code mapping for Amadeus (IATA codes)
const CITY_CODES: Record<string, string> = {
  'washington': 'WAS', 'new york': 'NYC', 'san francisco': 'SFO',
  'denver': 'DEN', 'san diego': 'SAN', 'huntsville': 'HSV',
  'san antonio': 'SAT', 'virginia beach': 'ORF', 'fayetteville': 'FAY',
  'tampa': 'TPA', 'jacksonville': 'JAX', 'norfolk': 'ORF',
  'el paso': 'ELP', 'honolulu': 'HNL', 'anchorage': 'ANC',
  'los angeles': 'LAX', 'chicago': 'CHI', 'dallas': 'DFW',
  'houston': 'IAH', 'seattle': 'SEA', 'atlanta': 'ATL',
  'boston': 'BOS', 'phoenix': 'PHX', 'las vegas': 'LAS',
  'miami': 'MIA', 'portland': 'PDX', 'austin': 'AUS',
  'nashville': 'BNA', 'minneapolis': 'MSP', 'detroit': 'DTW',
  'philadelphia': 'PHL', 'charlotte': 'CLT', 'raleigh': 'RDU',
  'salt lake city': 'SLC', 'st louis': 'STL', 'kansas city': 'MCI',
  'columbus': 'CMH', 'indianapolis': 'IND', 'cincinnati': 'CVG',
  'pittsburgh': 'PIT', 'sacramento': 'SMF', 'orlando': 'MCO',
  'colorado springs': 'COS', 'omaha': 'OMA', 'albuquerque': 'ABQ',
  'tucson': 'TUS', 'oklahoma city': 'OKC', 'memphis': 'MEM',
  'louisville': 'SDF', 'baltimore': 'BWI', 'milwaukee': 'MKE',
};

export function getCityCode(city: string): string | null {
  const normalized = city.toLowerCase().trim();
  return CITY_CODES[normalized] || null;
}

// --- Amadeus Hotel Search Types ---

interface AmadeusHotelListItem {
  hotelId: string;
  name: string;
  geoCode?: { latitude: number; longitude: number };
  address?: { countryCode: string };
}

interface AmadeusHotelOffer {
  type: string;
  hotel: {
    hotelId: string;
    name: string;
    rating?: string;
    cityCode?: string;
    latitude?: number;
    longitude?: number;
  };
  available: boolean;
  offers: Array<{
    id: string;
    checkInDate: string;
    checkOutDate: string;
    room: {
      type: string;
      typeEstimated?: { category: string; beds: number; bedType: string };
      description?: { text: string };
    };
    guests?: { adults: number };
    price: {
      currency: string;
      total: string;
      base?: string;
      variations?: {
        average?: { base: string };
        changes?: Array<{ startDate: string; endDate: string; total: string }>;
      };
    };
  }>;
}

interface AmadeusHotelOffersResponse {
  data: AmadeusHotelOffer[];
}

interface AmadeusHotelListResponse {
  data: AmadeusHotelListItem[];
}

export interface HotelSearchResult {
  hotelId: string;
  name: string;
  rating: number | null;
  totalPrice: number;
  pricePerNight: number;
  currency: string;
  roomType: string | null;
  roomDescription: string | null;
  checkIn: string;
  checkOut: string;
}

export async function searchHotels(params: SearchParams): Promise<HotelSearchResult[]> {
  const cityCode = getCityCode(params.destination);
  if (!cityCode) {
    throw new Error(`No IATA city code found for "${params.destination}". Try a major US city.`);
  }

  // Step 1: Get hotel IDs for the city (limit to 20 for API quota)
  const hotelListRes = await amadeusGet<AmadeusHotelListResponse>(
    `/v1/reference-data/locations/hotels/by-city?cityCode=${cityCode}&radius=25&radiusUnit=KM&hotelSource=ALL`
  );

  if (!hotelListRes.data || hotelListRes.data.length === 0) {
    return [];
  }

  // Take up to 20 hotel IDs (Amadeus limits per request)
  const hotelIds = hotelListRes.data
    .slice(0, 20)
    .map((h) => h.hotelId)
    .join(',');

  // Step 2: Get offers/prices for those hotels
  const adults = params.adults || 1;
  const offersRes = await amadeusGet<AmadeusHotelOffersResponse>(
    `/v3/shopping/hotel-offers?hotelIds=${hotelIds}&checkInDate=${params.checkIn}&checkOutDate=${params.checkOut}&adults=${adults}&currency=USD`
  );

  if (!offersRes.data || offersRes.data.length === 0) {
    return [];
  }

  const results: HotelSearchResult[] = [];

  for (const hotel of offersRes.data) {
    if (!hotel.available || !hotel.offers || hotel.offers.length === 0) continue;

    const offer = hotel.offers[0]; // cheapest offer
    const totalPrice = parseFloat(offer.price.total);
    const nights = Math.max(1, Math.ceil(
      (new Date(offer.checkOutDate).getTime() - new Date(offer.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
    ));
    const pricePerNight = Math.round((totalPrice / nights) * 100) / 100;

    results.push({
      hotelId: hotel.hotel.hotelId,
      name: hotel.hotel.name,
      rating: hotel.hotel.rating ? parseFloat(hotel.hotel.rating) : null,
      totalPrice,
      pricePerNight,
      currency: offer.price.currency || 'USD',
      roomType: offer.room?.typeEstimated?.category || offer.room?.type || null,
      roomDescription: offer.room?.description?.text || null,
      checkIn: offer.checkInDate,
      checkOut: offer.checkOutDate,
    });
  }

  // Sort by price ascending (cheapest first)
  results.sort((a, b) => a.pricePerNight - b.pricePerNight);

  return results;
}
