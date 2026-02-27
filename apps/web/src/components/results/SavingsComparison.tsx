'use client';

import type { SearchResult, PerDiemRates } from '@/types';

interface Props {
  savingsMax: SearchResult | null;
  smartValue: SearchResult | null;
  rates: PerDiemRates;
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function SavingsComparison({ savingsMax, smartValue, rates }: Props) {
  if (!savingsMax && !smartValue) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {savingsMax && savingsMax.perDiemDelta > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
          <div className="text-xs font-bold text-brand-600 uppercase tracking-wider mb-1">Max Savings</div>
          <div className="font-bold text-gray-900 text-sm truncate">{savingsMax.name}</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-extrabold text-brand-600">
              +{fmt.format(savingsMax.perDiemDelta)}
            </span>
            <span className="text-xs text-gray-400">
              ${savingsMax.pricePerNight ?? Math.round(savingsMax.price / (rates.nights || 1))}/nt
            </span>
          </div>
        </div>
      )}

      {smartValue && smartValue.id !== savingsMax?.id && (
        <div className="bg-accent-50 border border-accent-200 rounded-xl p-4">
          <div className="text-xs font-bold text-accent-600 uppercase tracking-wider mb-1">Smart Value</div>
          <div className="font-bold text-gray-900 text-sm truncate">{smartValue.name}</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-extrabold text-accent-600">
              {smartValue.perDiemDelta >= 0 ? '+' : ''}{fmt.format(smartValue.perDiemDelta)}
            </span>
            <span className="text-xs text-gray-400">
              ${smartValue.pricePerNight ?? Math.round(smartValue.price / (rates.nights || 1))}/nt
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
