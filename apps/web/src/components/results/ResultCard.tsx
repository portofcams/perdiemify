'use client';

import { PerDiemBadge } from './PerDiemBadge';
import { formatCurrency } from '@/lib/utils';
import type { SearchResult, PerDiemRates } from '@/types';

interface ResultCardProps {
  result: SearchResult;
  rates: PerDiemRates;
  isSavingsMax?: boolean;
  isSmartValue?: boolean;
}

export function ResultCard({ result, rates, isSavingsMax, isSmartValue }: ResultCardProps) {
  const totalSavings = result.perDiemDelta;
  const positive = totalSavings >= 0;

  return (
    <div className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow ${
      isSavingsMax ? 'border-green-300 ring-2 ring-green-100' :
      isSmartValue ? 'border-amber-300 ring-2 ring-amber-100' :
      'border-gray-100'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Tags */}
          {(isSavingsMax || isSmartValue) && (
            <div className="mb-2">
              {isSavingsMax && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
                  <span>💰</span> Savings Max
                </span>
              )}
              {isSmartValue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">
                  <span>⭐</span> Smart Value
                </span>
              )}
            </div>
          )}

          {/* Hotel name + badge */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{result.name}</h3>
            <PerDiemBadge badge={result.perDiemBadge} delta={result.pricePerNight ? rates.lodgingRate - result.pricePerNight : totalSavings} size="sm" />
          </div>

          {/* Rating */}
          {result.rating && (
            <div className="text-sm text-gray-400 mb-1">
              {'⭐'.repeat(Math.min(5, Math.floor(result.rating)))} {result.rating}
            </div>
          )}

          {/* Price detail */}
          <div className="text-sm text-gray-500 mb-1">
            {result.pricePerNight && (
              <>{formatCurrency(result.pricePerNight)}/night &middot; </>
            )}
            {formatCurrency(result.price)} total for {rates.nights} night{rates.nights !== 1 ? 's' : ''}
          </div>

          {/* Loyalty program */}
          {result.loyaltyProgram && (
            <div className="text-xs text-brand-600 font-medium">
              {result.loyaltyProgram}
              {result.estimatedPoints ? ` — Earn ~${result.estimatedPoints.toLocaleString()} pts` : ''}
            </div>
          )}

          {/* Room type / amenities */}
          {result.amenities.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {result.amenities.map((a, i) => (
                <span key={i} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{a}</span>
              ))}
            </div>
          )}
        </div>

        {/* Right side: savings + book */}
        <div className="text-right ml-4 flex-shrink-0">
          <div className={`text-2xl font-bold ${positive ? 'text-brand-600' : 'text-red-500'}`}>
            {positive ? `+${formatCurrency(totalSavings)}` : `-${formatCurrency(Math.abs(totalSavings))}`}
          </div>
          <div className="text-xs text-gray-400 mb-3">
            {positive ? 'you keep' : 'over budget'}
          </div>
          <button
            onClick={() => {
              if (result.affiliateLink) {
                window.open(result.affiliateLink, '_blank', 'noopener');
              }
            }}
            className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
}
