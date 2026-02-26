'use client';

import { useState } from 'react';
import { UnifiedSearchBar } from '@/components/search/UnifiedSearchBar';
import { PerDiemBreakdown } from '@/components/results/PerDiemBreakdown';
import { PerDiemBadge } from '@/components/results/PerDiemBadge';
import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { BookingType, PerDiemRates } from '@/types';

interface PerDiemCalcResponse extends PerDiemRates {
  summary: string;
  friendlyTotal: string;
}

export default function SearchPage() {
  const [rates, setRates] = useState<PerDiemCalcResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [searchParams, setSearchParams] = useState<{ city: string; state: string; type: BookingType } | null>(null);

  async function handleSearch(values: { city: string; state: string; checkIn: string; checkOut: string; type: BookingType }) {
    setLoading(true);
    setSearchDone(false);
    setSearchParams({ city: values.city, state: values.state, type: values.type });

    try {
      const res = await apiFetch<PerDiemCalcResponse>('/api/perdiem/calculate', {
        method: 'POST',
        body: JSON.stringify({
          city: values.city,
          state: values.state,
          checkIn: values.checkIn,
          checkOut: values.checkOut,
          perDiemSource: 'gsa',
        }),
      });

      if (res.success && res.data) {
        setRates(res.data);
      }
    } catch {
      // API not running yet — use mock data for UI development
      setRates({
        lodgingRate: 165,
        mieRate: 92,
        firstLastDayRate: 69,
        totalAllowance: 1142,
        totalLodgingAllowance: 825,
        totalMieAllowance: 317,
        nights: 5,
        days: 6,
        summary: '$165/night lodging + $92/day M&IE',
        friendlyTotal: 'Your 6-day trip allowance: $1,142',
      });
    } finally {
      setLoading(false);
      setSearchDone(true);
    }
  }

  // Mock search results for UI development
  const mockResults = rates ? [
    { name: 'Budget Inn Express', price: 89, perNight: 89, rating: 3.5, badge: 'under' as const, delta: rates.lodgingRate - 89 },
    { name: 'Comfort Suites Downtown', price: 129, perNight: 129, rating: 4.2, badge: 'under' as const, delta: rates.lodgingRate - 129 },
    { name: 'Hilton Garden Inn', price: 155, perNight: 155, rating: 4.5, badge: 'near' as const, delta: rates.lodgingRate - 155 },
    { name: 'Marriott City Center', price: 189, perNight: 189, rating: 4.6, badge: 'over' as const, delta: rates.lodgingRate - 189 },
    { name: 'Residence Inn (Extended Stay)', price: 109, perNight: 109, rating: 4.3, badge: 'under' as const, delta: rates.lodgingRate - 109 },
  ] : [];

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
          <UnifiedSearchBar onSearch={handleSearch} loading={loading} />
        </div>

        {/* Results */}
        {searchDone && rates && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Results list */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">
                  {searchParams?.type === 'hotel' ? 'Hotels' : searchParams?.type === 'flight' ? 'Flights' : 'Cars'} in {searchParams?.city}, {searchParams?.state}
                </h2>
                <span className="text-sm text-gray-400">{mockResults.length} results</span>
              </div>

              {/* Savings Max vs Smart Value */}
              {mockResults.length >= 2 && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span>💰</span>
                      <span className="text-sm font-bold text-green-700">Savings Max</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{mockResults[0]?.name}</div>
                    <div className="text-sm text-gray-500">{formatCurrency(mockResults[0]?.price ?? 0)}/night</div>
                    <div className="mt-2 text-green-700 font-bold text-xl">
                      You pocket {formatCurrency((mockResults[0]?.delta ?? 0) * rates.nights)}/trip
                    </div>
                  </div>
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span>⭐</span>
                      <span className="text-sm font-bold text-amber-700">Smart Value</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{mockResults[1]?.name}</div>
                    <div className="text-sm text-gray-500">{formatCurrency(mockResults[1]?.price ?? 0)}/night</div>
                    <div className="mt-2 text-amber-700 font-bold text-xl">
                      You pocket {formatCurrency((mockResults[1]?.delta ?? 0) * rates.nights)}/trip
                    </div>
                  </div>
                </div>
              )}

              {/* All results */}
              {mockResults.map((result, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{result.name}</h3>
                        <PerDiemBadge badge={result.badge} delta={result.delta} size="sm" />
                      </div>
                      <div className="text-sm text-gray-400 mb-2">
                        {'⭐'.repeat(Math.floor(result.rating))} {result.rating}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatCurrency(result.perNight)}/night &middot; {formatCurrency(result.price * rates.nights)} total for {rates.nights} nights
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className={`text-2xl font-bold ${result.delta >= 0 ? 'text-brand-600' : 'text-red-500'}`}>
                        {result.delta >= 0 ? `+${formatCurrency(result.delta * rates.nights)}` : `-${formatCurrency(Math.abs(result.delta) * rates.nights)}`}
                      </div>
                      <div className="text-xs text-gray-400 mb-3">
                        {result.delta >= 0 ? 'you keep' : 'over budget'}
                      </div>
                      <button className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Per Diem Breakdown sidebar */}
            <div className="space-y-4">
              <PerDiemBreakdown rates={rates} />
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
