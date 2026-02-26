'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

// Top per diem destinations for quick suggestions
const POPULAR_CITIES = [
  { city: 'Washington', state: 'DC', label: 'Washington, DC' },
  { city: 'New York', state: 'NY', label: 'New York, NY' },
  { city: 'San Francisco', state: 'CA', label: 'San Francisco, CA' },
  { city: 'Denver', state: 'CO', label: 'Denver, CO' },
  { city: 'San Diego', state: 'CA', label: 'San Diego, CA' },
  { city: 'Colorado Springs', state: 'CO', label: 'Colorado Springs, CO' },
  { city: 'Huntsville', state: 'AL', label: 'Huntsville, AL' },
  { city: 'San Antonio', state: 'TX', label: 'San Antonio, TX' },
  { city: 'Virginia Beach', state: 'VA', label: 'Virginia Beach, VA' },
  { city: 'Fayetteville', state: 'NC', label: 'Fayetteville, NC' },
  { city: 'Tampa', state: 'FL', label: 'Tampa, FL' },
  { city: 'Killeen', state: 'TX', label: 'Killeen, TX' },
  { city: 'Jacksonville', state: 'FL', label: 'Jacksonville, FL' },
  { city: 'Norfolk', state: 'VA', label: 'Norfolk, VA' },
  { city: 'El Paso', state: 'TX', label: 'El Paso, TX' },
  { city: 'Honolulu', state: 'HI', label: 'Honolulu, HI' },
  { city: 'Anchorage', state: 'AK', label: 'Anchorage, AK' },
  { city: 'Los Angeles', state: 'CA', label: 'Los Angeles, CA' },
  { city: 'Chicago', state: 'IL', label: 'Chicago, IL' },
  { city: 'Dallas', state: 'TX', label: 'Dallas, TX' },
  { city: 'Houston', state: 'TX', label: 'Houston, TX' },
  { city: 'Seattle', state: 'WA', label: 'Seattle, WA' },
  { city: 'Atlanta', state: 'GA', label: 'Atlanta, GA' },
  { city: 'Boston', state: 'MA', label: 'Boston, MA' },
  { city: 'Phoenix', state: 'AZ', label: 'Phoenix, AZ' },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (city: string, state: string) => void;
  placeholder?: string;
  className?: string;
}

export function CityAutocomplete({ value, onChange, onSelect, placeholder = 'City, State', className }: Props) {
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState(POPULAR_CITIES);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!value.trim()) {
      setFiltered(POPULAR_CITIES.slice(0, 8));
      return;
    }
    const query = value.toLowerCase();
    setFiltered(
      POPULAR_CITIES.filter((c) => c.label.toLowerCase().includes(query)).slice(0, 8)
    );
  }, [value]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-gray-900 placeholder:text-gray-400 transition-all"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-auto">
          {filtered.map((item) => (
            <li
              key={item.label}
              onClick={() => {
                onChange(item.label);
                onSelect(item.city, item.state);
                setOpen(false);
              }}
              className="px-4 py-2.5 hover:bg-brand-50 cursor-pointer text-sm text-gray-700 first:rounded-t-xl last:rounded-b-xl transition-colors"
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
