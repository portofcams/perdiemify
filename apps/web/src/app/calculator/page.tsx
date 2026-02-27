'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { PerDiemRates } from '@/types';

interface CalcResult extends PerDiemRates {
  summary: string;
  friendlyTotal: string;
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
];

export default function CalculatorPage() {
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!city || !state || !checkIn || !checkOut) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await apiFetch<CalcResult>('/api/perdiem/calculate', {
        method: 'POST',
        body: JSON.stringify({
          city,
          state,
          checkIn,
          checkOut,
          perDiemSource: 'gsa',
        }),
      });

      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || 'Failed to calculate per diem rates. Try again.');
      }
    } catch {
      setError('Could not connect to the server. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  return (
    <div className="min-h-screen bg-gray-50 bg-travel-pattern">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-extrabold text-gradient">
            Perdiemify
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/search" className="text-sm font-medium text-gray-500 hover:text-brand-600 transition-colors">
              Search
            </Link>
            <Link href="/calculator" className="text-sm font-medium text-brand-600">
              Calculator
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Page title */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2">
            Per Diem Calculator
          </h1>
          <p className="text-gray-500 max-w-lg mx-auto">
            Enter your travel details to see your full GSA per diem allowance breakdown — lodging, M&IE, and total.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Washington"
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-500 focus:outline-none transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  State
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-500 focus:outline-none transition-colors text-sm bg-white"
                >
                  <option value="">Select state...</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Check-in Date
                </label>
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-500 focus:outline-none transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Check-out Date
                </label>
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-500 focus:outline-none transition-colors text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-brand-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Calculating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  Calculate Per Diem
                </>
              )}
            </button>
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-8">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Summary card */}
            <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl p-6 text-white">
              <h2 className="text-lg font-bold mb-1">Total Trip Allowance</h2>
              <div className="text-4xl font-extrabold mb-2">{fmt(result.totalAllowance)}</div>
              <p className="text-brand-100 text-sm">{result.friendlyTotal}</p>
            </div>

            {/* Breakdown grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-sm font-semibold text-gray-500 mb-1">Lodging Rate</div>
                <div className="text-2xl font-bold text-gray-900">{fmt(result.lodgingRate)}</div>
                <div className="text-xs text-gray-400 mt-1">per night</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-sm font-semibold text-gray-500 mb-1">M&IE Rate</div>
                <div className="text-2xl font-bold text-gray-900">{fmt(result.mieRate)}</div>
                <div className="text-xs text-gray-400 mt-1">per day (meals & incidentals)</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-sm font-semibold text-gray-500 mb-1">Total Lodging</div>
                <div className="text-2xl font-bold text-gray-900">{fmt(result.totalLodgingAllowance)}</div>
                <div className="text-xs text-gray-400 mt-1">{result.nights} night{result.nights !== 1 ? 's' : ''}</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-sm font-semibold text-gray-500 mb-1">Total M&IE</div>
                <div className="text-2xl font-bold text-gray-900">{fmt(result.totalMieAllowance)}</div>
                <div className="text-xs text-gray-400 mt-1">{result.days} day{result.days !== 1 ? 's' : ''} (first/last at 75%)</div>
              </div>
            </div>

            {/* Info box */}
            <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4">
              <div className="text-sm font-bold text-brand-700 mb-1">How it works</div>
              <p className="text-sm text-brand-600">
                GSA per diem covers lodging and meals & incidental expenses (M&IE).
                First and last travel days are reimbursed at 75% of the M&IE rate.
                Book a hotel under the lodging rate and you keep the difference.
              </p>
            </div>

            {/* CTA */}
            <div className="text-center">
              <Link
                href={`/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-brand-500/25"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                Search Hotels in {city}, {state}
              </Link>
            </div>
          </div>
        )}

        {/* SEO content */}
        {!result && !error && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">What is Per Diem?</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Per diem is a daily allowance for lodging and meals & incidental expenses (M&IE)
              provided to government, military, and many corporate travelers. The General Services
              Administration (GSA) sets rates for each location in the US, updated annually.
            </p>
            <h3 className="text-base font-bold text-gray-900 mb-2">How Per Diem Savings Work</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              When you book a hotel under the per diem lodging rate, many agencies let you
              pocket the difference. This calculator shows your exact allowance so you can maximize
              savings on every trip.
            </p>
            <h3 className="text-base font-bold text-gray-900 mb-2">First & Last Day Rule</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              On your first and last travel days, M&IE is calculated at 75% of the full daily rate.
              This is the standard GSA rule and is automatically applied in our calculator.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
