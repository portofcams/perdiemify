'use client';

import type { SearchResult, PerDiemRates } from '@/types';

interface Props {
  result: SearchResult;
  rates?: PerDiemRates;
  isSavingsMax?: boolean;
  isSmartValue?: boolean;
}

function badgeColor(badge: string) {
  switch (badge) {
    case 'under':
      return 'bg-brand-50 text-brand-700 border-brand-200';
    case 'near':
      return 'bg-accent-50 text-accent-700 border-accent-200';
    case 'over':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

function badgeLabel(badge: string) {
  switch (badge) {
    case 'under':
      return 'Under Budget';
    case 'near':
      return 'Near Budget';
    case 'over':
      return 'Over Budget';
    default:
      return badge;
  }
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function ResultCard({ result, rates, isSavingsMax, isSmartValue }: Props) {
  const nightly = result.pricePerNight ?? Math.round(result.price / (rates?.nights || 1));

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all p-5 ${
        isSavingsMax
          ? 'border-brand-300 ring-2 ring-brand-100'
          : isSmartValue
          ? 'border-accent-300 ring-2 ring-accent-100'
          : 'border-gray-100 hover:border-brand-200'
      }`}
    >
      {/* Tags row */}
      {(isSavingsMax || isSmartValue) && (
        <div className="flex gap-2 mb-3">
          {isSavingsMax && (
            <span className="text-xs font-bold bg-brand-500 text-white px-2.5 py-0.5 rounded-full">
              Max Savings
            </span>
          )}
          {isSmartValue && (
            <span className="text-xs font-bold bg-accent-500 text-white px-2.5 py-0.5 rounded-full">
              Smart Value
            </span>
          )}
        </div>
      )}

      <div className="flex items-start sm:items-center gap-4">
        {/* Hotel icon */}
        <div className="w-14 h-14 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
          <svg className="w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
          </svg>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-900 truncate">{result.name}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
            {result.location && <span>{result.location}</span>}
            {result.loyaltyProgram && (
              <span>
                {result.loyaltyProgram}
                {result.estimatedPoints ? ` — ~${result.estimatedPoints.toLocaleString()} pts` : ''}
              </span>
            )}
            {result.rating && (
              <span className="text-accent-600 font-medium flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {result.rating}
              </span>
            )}
          </div>
          {result.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {result.amenities.slice(0, 3).map((a) => (
                <span key={a} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Price + Badge */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeColor(result.perDiemBadge)}`}>
            {badgeLabel(result.perDiemBadge)}
          </span>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900">
              ${nightly}
              <span className="text-xs font-normal text-gray-400">/nt</span>
            </div>
            <div className={`text-sm font-semibold ${result.perDiemDelta >= 0 ? 'text-brand-600' : 'text-red-500'}`}>
              {result.perDiemDelta >= 0 ? '+' : ''}{fmt.format(result.perDiemDelta)}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {fmt.format(result.price)} total
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
