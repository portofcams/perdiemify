'use client';

import { useState } from 'react';
import { UnifiedSearchBar } from '@/components/search/UnifiedSearchBar';
import { PerDiemBreakdown } from '@/components/results/PerDiemBreakdown';
import { ResultCard } from '@/components/results/ResultCard';
import { SavingsComparison } from '@/components/results/SavingsComparison';
import { apiFetch } from '@/lib/api';
import type { BookingType, PerDiemRates, SearchResult, SearchResponse } from '@/types';

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

  const savingsMax = mockHotels[0]; // Budget Inn = most savings
  const smartValue = mockHotels[4]; // Residence Inn = good balance

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

  async function handleSearch(values: { city: string; state: string; checkIn: string; checkOut: string; type: BookingType }) {
    setLoading(true);
    setSearchDone(false);
    setUsingMockData(false);
    setSearchParams({ city: values.city, state: values.state, type: values.type });

    try {
      // Try real hotel search API first
      const searchRes = await apiFetch<SearchResponse>('/api/search/hotels', {
        method: 'POST',
        body: JSON.stringify({
          destination: values.city,
          destinationState: values.state,
          checkIn: values.checkIn,
          checkOut: values.checkOut,
          type: values.type,
        }),
      });

      if (searchRes.success && searchRes.data && searchRes.data.results.length > 0) {
        setSearchResponse(searchRes.data);
        setRates({
          ...searchRes.data.perDiemRates,
          summary: `$${searchRes.data.perDiemRates.lodgingRate}/night lodging + $${searchRes.data.perDiemRates.mieRate}/day M&IE`,
          friendlyTotal: `Your ${searchRes.data.perDiemRates.days}-day trip allowance: $${searchRes.data.perDiemRates.totalAllowance.toLocaleString()}`,
        });
        return;
      }
    } catch {
      // API not available — fall through to mock
    }

    // Fallback: get per diem rates and use mock hotel data
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

  // Finalize loading state in a stable way
  function onSearchComplete() {
    setLoading(false);
    setSearchDone(true);
  }

  // Wrap handleSearch to always finalize
  async function onSearch(values: { city: string; state: string; checkIn: string; checkOut: string; type: BookingType }) {
    try {
      await handleSearch(values);
    } finally {
      onSearchComplete();
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="text-2xl font-extrabold text-gradient">Perdiemify</a>
          <div className="flex items-center gap-3">
            <a href="/search" className="text-sm font-medium text-brand-600">Search</a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-700">Dashboard</a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-700">Deals</a>
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
        {searchDone && searchResponse && rates && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Results list */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">
                  {searchParams?.type === 'hotel' ? 'Hotels' : searchParams?.type === 'flight' ? 'Flights' : 'Cars'} in {searchParams?.city}, {searchParams?.state}
                </h2>
                <div className="flex items-center gap-2">
                  {usingMockData && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Demo data</span>
                  )}
                  <span className="text-sm text-gray-400">{searchResponse.results.length} results</span>
                </div>
              </div>

              {/* Savings Max vs Smart Value */}
              <SavingsComparison
                savingsMax={searchResponse.savingsMax}
                smartValue={searchResponse.smartValue}
                rates={rates}
              />

              {/* All results */}
              {searchResponse.results.map((result) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  rates={rates}
                  isSavingsMax={result.id === searchResponse.savingsMax?.id}
                  isSmartValue={result.id === searchResponse.smartValue?.id}
                />
              ))}

              {searchResponse.results.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🏨</div>
                  <p className="text-gray-500">No hotels found for these dates. Try different dates or another city.</p>
                </div>
              )}
            </div>

            {/* Right: Per Diem Breakdown sidebar */}
            <div className="space-y-4">
              <PerDiemBreakdown rates={rates} />

              {/* Quick savings tip */}
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
