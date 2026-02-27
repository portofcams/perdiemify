'use client';

import { formatCurrency } from '@/lib/utils';
import type { SearchResult, PerDiemRates } from '@/types';

interface SavingsComparisonProps {
  savingsMax: SearchResult | null;
  smartValue: SearchResult | null;
  rates: PerDiemRates;
}

export function SavingsComparison({ savingsMax, smartValue, rates }: SavingsComparisonProps) {
  if (!savingsMax && !smartValue) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
      {/* Savings Max */}
      {savingsMax && (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 hover:border-green-300 transition-colors">
          <div className="flex items-center gap-1.5 mb-2">
            <span>💰</span>
            <span className="text-sm font-bold text-green-700">Savings Max</span>
          </div>
          <div className="text-lg font-bold text-gray-900 truncate">{savingsMax.name}</div>
          <div className="text-sm text-gray-500">
            {savingsMax.pricePerNight ? formatCurrency(savingsMax.pricePerNight) : formatCurrency(savingsMax.price / rates.nights)}/night
          </div>
          {savingsMax.rating && (
            <div className="text-xs text-gray-400 mt-0.5">
              {'⭐'.repeat(Math.min(5, Math.floor(savingsMax.rating)))} {savingsMax.rating}
            </div>
          )}
          <div className="mt-2 text-green-700 font-bold text-xl">
            You pocket {formatCurrency(savingsMax.perDiemDelta)}/trip
          </div>
          {savingsMax.loyaltyProgram && (
            <div className="text-xs text-green-600 mt-1">
              + {savingsMax.loyaltyProgram} points
            </div>
          )}
        </div>
      )}

      {/* Smart Value */}
      {smartValue && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 hover:border-amber-300 transition-colors">
          <div className="flex items-center gap-1.5 mb-2">
            <span>⭐</span>
            <span className="text-sm font-bold text-amber-700">Smart Value</span>
          </div>
          <div className="text-lg font-bold text-gray-900 truncate">{smartValue.name}</div>
          <div className="text-sm text-gray-500">
            {smartValue.pricePerNight ? formatCurrency(smartValue.pricePerNight) : formatCurrency(smartValue.price / rates.nights)}/night
          </div>
          {smartValue.rating && (
            <div className="text-xs text-gray-400 mt-0.5">
              {'⭐'.repeat(Math.min(5, Math.floor(smartValue.rating)))} {smartValue.rating}
            </div>
          )}
          <div className="mt-2 text-amber-700 font-bold text-xl">
            You pocket {formatCurrency(smartValue.perDiemDelta)}/trip
          </div>
          {smartValue.loyaltyProgram && (
            <div className="text-xs text-amber-600 mt-1">
              + {smartValue.loyaltyProgram} points
            </div>
          )}
        </div>
      )}
    </div>
  );
}
