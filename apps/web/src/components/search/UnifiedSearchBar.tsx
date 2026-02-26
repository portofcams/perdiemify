'use client';

import { useState } from 'react';
import { CityAutocomplete } from './CityAutocomplete';
import type { BookingType } from '@/types';

interface SearchValues {
  city: string;
  state: string;
  checkIn: string;
  checkOut: string;
  type: BookingType;
}

interface Props {
  onSearch: (values: SearchValues) => void;
  loading?: boolean;
}

const searchTabs: { value: BookingType; label: string; icon: string }[] = [
  { value: 'hotel', label: 'Hotels', icon: '🏨' },
  { value: 'flight', label: 'Flights', icon: '✈️' },
  { value: 'car', label: 'Cars', icon: '🚗' },
];

export function UnifiedSearchBar({ onSearch, loading }: Props) {
  const [cityDisplay, setCityDisplay] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [type, setType] = useState<BookingType>('hotel');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!city || !state || !checkIn || !checkOut) return;
    onSearch({ city, state, checkIn, checkOut, type });
  }

  // Set minimum check-in to today
  const today = new Date().toISOString().split('T')[0]!;

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {/* Search type tabs */}
      <div className="flex gap-1 mb-4">
        {searchTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setType(tab.value)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              type === tab.value
                ? 'bg-brand-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <CityAutocomplete
          value={cityDisplay}
          onChange={setCityDisplay}
          onSelect={(c, s) => { setCity(c); setState(s); }}
          placeholder="Where are you going?"
        />
        <input
          type="date"
          value={checkIn}
          min={today}
          onChange={(e) => {
            setCheckIn(e.target.value);
            // Auto-advance checkout if before checkin
            if (checkOut && e.target.value > checkOut) setCheckOut('');
          }}
          className="px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-gray-900 transition-all"
        />
        <input
          type="date"
          value={checkOut}
          min={checkIn || today}
          onChange={(e) => setCheckOut(e.target.value)}
          className="px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-gray-900 transition-all"
        />
        <button
          type="submit"
          disabled={loading || !city || !checkIn || !checkOut}
          className="px-6 py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-brand-500/25 disabled:shadow-none"
        >
          {loading ? 'Searching...' : 'Search & Save'}
        </button>
      </div>
    </form>
  );
}
