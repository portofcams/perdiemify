'use client';

import { useState } from 'react';
import type { BookingType } from '@/types';

export interface SearchValues {
  city: string;
  state: string;
  origin: string;
  checkIn: string;
  checkOut: string;
  type: BookingType;
}

interface Props {
  onSearch: (values: SearchValues) => void;
  loading: boolean;
}

const tabs: { id: BookingType; label: string; icon: string }[] = [
  { id: 'hotel', label: 'Hotels', icon: '🏨' },
  { id: 'flight', label: 'Flights', icon: '✈️' },
  { id: 'car', label: 'Cars', icon: '🚗' },
];

export function UnifiedSearchBar({ onSearch, loading }: Props) {
  const [type, setType] = useState<BookingType>('hotel');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [origin, setOrigin] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city || !checkIn) return;
    if (type !== 'flight' && !checkOut) return;
    onSearch({ city, state, origin, checkIn, checkOut, type });
  };

  const isFlightMode = type === 'flight';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setType(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              type === tab.id
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Fields */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isFlightMode ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-3`}>
        {/* Origin — flights only */}
        {isFlightMode && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              From
            </label>
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="Denver"
              required
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-500 focus:outline-none transition-colors text-sm"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            {isFlightMode ? 'To' : 'City'}
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

        {!isFlightMode && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              State
            </label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              placeholder="DC"
              maxLength={2}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-500 focus:outline-none transition-colors text-sm uppercase"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            {isFlightMode ? 'Depart' : 'Check In'}
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
            {isFlightMode ? 'Return' : 'Check Out'}
          </label>
          <input
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            required={!isFlightMode}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-500 focus:outline-none transition-colors text-sm"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-brand-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Searching...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                Search
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
