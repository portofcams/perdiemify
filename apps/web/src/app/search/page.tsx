'use client';

import { useState, useMemo } from 'react';
import { UnifiedSearchBar, type SearchValues } from '@/components/search/UnifiedSearchBar';
import { PerDiemBreakdown } from '@/components/results/PerDiemBreakdown';
import { ResultCard } from '@/components/results/ResultCard';
import { SavingsComparison } from '@/components/results/SavingsComparison';
import { apiFetch } from '@/lib/api';
import type { BookingType, PerDiemRates, SearchResult, SearchResponse } from '@/types';
import { AdSlot } from '@/components/AdSlot';

interface FeaturedListing {
  id: string;
  advertiserName: string;
  listingType: string;
  creativeUrl: string | null;
  landingUrl: string;
}


interface PerDiemCalcResponse extends PerDiemRates {
  summary: string;
  friendlyTotal: string;
}

// Mock results fallback when API/Amadeus unavailable
function getMockResults(rates: PerDiemRates): SearchResponse {
  const mockHotels: SearchResult[] = [
    {
      id: 'mock-1', type: 'hotel', provider: 'mock', providerName: 'Demo',
      name: 'Budget Inn Express', description: null,
      price: 89 * rates.nights, pricePerNight: 89, currency: 'USD',
      perDiemDelta: (rates.lodgingRate - 89) * rates.nights,
      perDiemBadge: 'under', affiliateLink: '', imageUrl: null,
      rating: 3.5, loyaltyProgram: null, estimatedPoints: null,
      discountCodes: [], amenities: ['Standard Room'], location: null,
    },
    {
      id: 'mock-2', type: 'hotel', provider: 'mock', providerName: 'Demo',
      name: 'Comfort Suites Downtown', description: null,
      price: 129 * rates.nights, pricePerNight: 129, currency: 'USD',
      perDiemDelta: (rates.lodgingRate - 129) * rates.nights,
      perDiemBadge: rates.lodgingRate >= 129 * 1.18 ? 'under' : 'near',
      affiliateLink: '', imageUrl: null,
      rating: 4.2, loyaltyProgram: 'Choice Privileges', estimatedPoints: Math.round(129 * rates.nights * 10),
      discountCodes: [], amenities: ['Suite', 'Breakfast'], location: null,
    },
    {
      id: 'mock-3', type: 'hotel', provider: 'mock', providerName: 'Demo',
      name: 'Hilton Garden Inn', description: null,
      price: 155 * rates.nights, pricePerNight: 155, currency: 'USD',
      perDiemDelta: (rates.lodgingRate - 155) * rates.nights,
      perDiemBadge: rates.lodgingRate >= 155 ? 'near' : 'over',
      affiliateLink: '', imageUrl: null,
      rating: 4.5, loyaltyProgram: 'Hilton Honors', estimatedPoints: Math.round(155 * rates.nights * 10),
      discountCodes: [], amenities: ['King Room', 'Pool', 'Fitness'], location: null,
    },
    {
      id: 'mock-4', type: 'hotel', provider: 'mock', providerName: 'Demo',
      name: 'Marriott City Center', description: null,
      price: 189 * rates.nights, pricePerNight: 189, currency: 'USD',
      perDiemDelta: (rates.lodgingRate - 189) * rates.nights,
      perDiemBadge: 'over', affiliateLink: '', imageUrl: null,
      rating: 4.6, loyaltyProgram: 'Marriott Bonvoy', estimatedPoints: Math.round(189 * rates.nights * 10),
      discountCodes: [], amenities: ['King Suite', 'Lounge', 'Valet'], location: null,
    },
    {
      id: 'mock-5', type: 'hotel', provider: 'mock', providerName: 'Demo',
      name: 'Residence Inn (Extended Stay)', description: null,
      price: 109 * rates.nights, pricePerNight: 109, currency: 'USD',
      perDiemDelta: (rates.lodgingRate - 109) * rates.nights,
      perDiemBadge: 'under', affiliateLink: '', imageUrl: null,
      rating: 4.3, loyaltyProgram: 'Marriott Bonvoy', estimatedPoints: Math.round(109 * rates.nights * 10),
      discountCodes: [], amenities: ['Studio Suite', 'Kitchen', 'Breakfast'], location: null,
    },
  ];

  const savingsMax = mockHotels[0];
  const smartValue = mockHotels[4];

  return {
    results: mockHotels,
    perDiemRates: rates,
    savingsMax,
    smartValue,
    cached: false,
    searchId: 'mock-search',
  };
}

export default function SearchPage() {
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [rates, setRates] = useState<(PerDiemRates & { summary: string; friendlyTotal: string }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [searchParams, setSearchParams] = useState<{ city: string; state: string; type: BookingType } | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [sponsoredListings, setSponsoredListings] = useState<FeaturedListing[]>([]);
  const [sortBy, setSortBy] = useState<'savings' | 'price' | 'rating'>('savings');
  const [budgetFilter, setBudgetFilter] = useState<'all' | 'under' | 'near' | 'over'>('all');
  const [minRating, setMinRating] = useState(0);

  const filteredResults = useMemo(() => {
    if (!searchResponse) return [];
    let results = [...searchResponse.results];

    // Budget filter
    if (budgetFilter !== 'all') {
      results = results.filter((r) => r.perDiemBadge === budgetFilter);
    }

    // Rating filter
    if (minRating > 0) {
      results = results.filter((r) => (r.rating || 0) >= minRating);
    }

    // Sort
    results.sort((a, b) => {
      switch (sortBy) {
        case 'savings': return b.perDiemDelta - a.perDiemDelta;
        case 'price': return a.price - b.price;
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        default: return 0;
      }
    });

    return results;
  }, [searchResponse, sortBy, budgetFilter, minRating]);

  async function handleSearch(values: SearchValues) {
    setLoading(true);
    setSearchDone(false);
    setUsingMockData(false);
    setSearchParams({ city: values.city, state: values.state, type: values.type });

    // Fetch sponsored listings in parallel
    apiFetch<FeaturedListing[]>(
      `/api/featured-listings?type=${values.type}&destination=${encodeURIComponent(values.city)}`
    ).then((res) => {
      if (res.success && res.data) setSponsoredListings(res.data);
    }).catch(() => {});

    // Determine which API endpoint to call
    const endpoint = values.type === 'flight'
      ? '/api/search/flights'
      : values.type === 'car'
        ? '/api/search/cars'
        : '/api/search/hotels';

    try {
      const searchRes = await apiFetch<SearchResponse>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          origin: values.origin,
          destination: values.city,
          destinationState: values.state,
          checkIn: values.checkIn,
          checkOut: values.checkOut,
          type: values.type,
        }),
      });

      if (searchRes.success && searchRes.data && searchRes.data.results.length > 0) {
        setSearchResponse(searchRes.data);
        if (searchRes.data.perDiemRates.lodgingRate > 0) {
          setRates({
            ...searchRes.data.perDiemRates,
            summary: `$${searchRes.data.perDiemRates.lodgingRate}/night lodging + $${searchRes.data.perDiemRates.mieRate}/day M&IE`,
            friendlyTotal: `Your ${searchRes.data.perDiemRates.days}-day trip allowance: $${searchRes.data.perDiemRates.totalAllowance.toLocaleString()}`,
          });
        } else {
          // Cars/flights may not have per diem rates
          setRates(null);
        }
        return;
      }
    } catch {
      // API not available — fall through to mock (hotels only)
    }

    // Fallback for hotels only
    if (values.type === 'hotel') {
      try {
        const perdiemRes = await apiFetch<PerDiemCalcResponse>('/api/perdiem/calculate', {
          method: 'POST',
          body: JSON.stringify({
            city: values.city,
            state: values.state,
            checkIn: values.checkIn,
            checkOut: values.checkOut,
            perDiemSource: 'gsa',
          }),
        });

        if (perdiemRes.success && perdiemRes.data) {
          setRates(perdiemRes.data);
          setSearchResponse(getMockResults(perdiemRes.data));
          setUsingMockData(true);
          return;
        }
      } catch {
        // Per diem API also unavailable
      }

      // Last resort: fully offline mock
      const mockRates: PerDiemCalcResponse = {
        lodgingRate: 165, mieRate: 92, firstLastDayRate: 69,
        totalAllowance: 1142, totalLodgingAllowance: 825, totalMieAllowance: 317,
        nights: 5, days: 6,
        summary: '$165/night lodging + $92/day M&IE',
        friendlyTotal: 'Your 6-day trip allowance: $1,142',
      };
      setRates(mockRates);
      setSearchResponse(getMockResults(mockRates));
      setUsingMockData(true);
    }
  }

  function onSearchComplete() {
    setLoading(false);
    setSearchDone(true);
  }

  async function onSearch(values: SearchValues) {
    try {
      await handleSearch(values);
    } finally {
      onSearchComplete();
    }
  }

  const typeLabel = searchParams?.type === 'hotel' ? 'Hotels' : searchParams?.type === 'flight' ? 'Flights' : 'Cars';
  const emptyIcon = searchParams?.type === 'flight' ? '✈️' : searchParams?.type === 'car' ? '🚗' : '🏨';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="text-2xl font-extrabold text-gradient">Perdiemify</a>
          <div className="flex items-center gap-3">
            <a href="/search" className="text-sm font-medium text-brand-600">Search</a>
            <a href="/calculator" className="text-sm text-gray-500 hover:text-gray-700">Calculator</a>
            <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">Dashboard</a>
          </div>
        </div>
      </header>

      {/* Search Section */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Search & Save</h1>
          <p className="text-gray-500">Find the best deals and see exactly what you pocket.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <UnifiedSearchBar onSearch={onSearch} loading={loading} />
        </div>

        {/* Results */}
        {searchDone && searchResponse && (
          <div className={`grid grid-cols-1 ${rates ? 'lg:grid-cols-3' : ''} gap-6`}>
            {/* Left: Results list */}
            <div className={rates ? 'lg:col-span-2' : ''}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  {typeLabel} in {searchParams?.city}{searchParams?.state ? `, ${searchParams.state}` : ''}
                </h2>
                <div className="flex items-center gap-2">
                  {usingMockData && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Demo data</span>
                  )}
                  <span className="text-sm text-gray-400">{filteredResults.length} of {searchResponse.results.length}</span>
                </div>
              </div>

              {/* Filter & Sort Controls */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'savings' | 'price' | 'rating')}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg text-gray-700"
                >
                  <option value="savings">Sort: Most Savings</option>
                  <option value="price">Sort: Lowest Price</option>
                  <option value="rating">Sort: Highest Rating</option>
                </select>

                {/* Budget filter */}
                <div className="flex gap-1">
                  {(['all', 'under', 'near', 'over'] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => setBudgetFilter(b)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        budgetFilter === b
                          ? b === 'under' ? 'bg-brand-50 text-brand-700 border-brand-200'
                            : b === 'near' ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : b === 'over' ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {b === 'all' ? 'All' : b === 'under' ? 'Under Budget' : b === 'near' ? 'Near Budget' : 'Over Budget'}
                    </button>
                  ))}
                </div>

                {/* Rating filter */}
                <select
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg text-gray-700"
                >
                  <option value={0}>Any Rating</option>
                  <option value={3}>3+ Stars</option>
                  <option value={3.5}>3.5+ Stars</option>
                  <option value={4}>4+ Stars</option>
                  <option value={4.5}>4.5+ Stars</option>
                </select>
              </div>

              <div className="space-y-4">
                {/* Savings Max vs Smart Value */}
                {rates && (
                  <SavingsComparison
                    savingsMax={searchResponse.savingsMax}
                    smartValue={searchResponse.smartValue}
                    rates={rates}
                  />
                )}

                {/* All results with sponsored cards injected every 4th */}
                {filteredResults.map((result, idx) => (
                  <div key={result.id}>
                    <ResultCard
                      result={result}
                      rates={rates || undefined}
                      isSavingsMax={result.id === searchResponse.savingsMax?.id}
                      isSmartValue={result.id === searchResponse.smartValue?.id}
                    />
                    {/* Inject sponsored listing after every 4th result */}
                    {(idx + 1) % 4 === 0 && sponsoredListings[Math.floor(idx / 4)] && (
                      <SponsoredCard listing={sponsoredListings[Math.floor(idx / 4)]} />
                    )}
                  </div>
                ))}

                {filteredResults.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">{emptyIcon}</div>
                    <p className="text-gray-500">
                      {searchResponse.results.length === 0
                        ? `No ${typeLabel.toLowerCase()} found for these dates. Try different dates or another city.`
                        : 'No results match your filters. Try adjusting them.'}
                    </p>
                    {searchResponse.results.length > 0 && (
                      <button
                        onClick={() => { setBudgetFilter('all'); setMinRating(0); }}
                        className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Per Diem Breakdown sidebar (hotels only) */}
            {rates && (
              <div className="space-y-4">
                <PerDiemBreakdown rates={rates} />

                <AdSlot size="300x250" slot="sidebar-search" className="my-4" />

                {searchResponse.savingsMax && searchResponse.savingsMax.perDiemDelta > 0 && (
                  <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4">
                    <div className="text-sm font-bold text-brand-700 mb-1">Quick tip</div>
                    <p className="text-sm text-brand-600">
                      Booking {searchResponse.savingsMax.name} saves you{' '}
                      <strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(searchResponse.savingsMax.perDiemDelta)}</strong>{' '}
                      on this trip. That&apos;s money you keep!
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sponsored listings below results */}
        {searchDone && sponsoredListings.length > 0 && (
          <div className="mt-6">
            <AdSlot size="728x90" slot="below-results" />
          </div>
        )}

        {/* Empty state */}
        {!searchDone && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Find your next trip</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Search hotels, flights, and cars above. We&apos;ll show you the per diem impact on every result.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SponsoredCard({ listing }: { listing: FeaturedListing }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const handleClick = async () => {
    try {
      await fetch(`${apiUrl}/api/featured-listings/${listing.id}/click`, { method: 'POST' });
    } catch { /* silent */ }
    window.open(listing.landingUrl, '_blank', 'noopener');
  };

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 mt-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {listing.creativeUrl && (
            <img src={listing.creativeUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Sponsored</span>
              <span className="font-semibold text-gray-900 text-sm">{listing.advertiserName}</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleClick}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          View Deal
        </button>
      </div>
    </div>
  );
}
