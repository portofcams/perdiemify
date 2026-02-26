'use client';

import type { PerDiemRates } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface Props {
  rates: PerDiemRates & { summary?: string; friendlyTotal?: string };
}

export function PerDiemBreakdown({ rates }: Props) {
  return (
    <div className="bg-white border-2 border-brand-100 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">📋</span>
        <h3 className="font-bold text-gray-900">Your Per Diem Breakdown</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-brand-50 rounded-xl p-3 text-center">
          <div className="text-sm text-gray-500">Lodging Rate</div>
          <div className="text-2xl font-bold text-brand-700">{formatCurrency(rates.lodgingRate)}</div>
          <div className="text-xs text-gray-400">per night</div>
        </div>
        <div className="bg-brand-50 rounded-xl p-3 text-center">
          <div className="text-sm text-gray-500">M&IE Rate</div>
          <div className="text-2xl font-bold text-brand-700">{formatCurrency(rates.mieRate)}</div>
          <div className="text-xs text-gray-400">per day</div>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Lodging ({rates.nights} night{rates.nights !== 1 ? 's' : ''})</span>
          <span className="font-medium">{formatCurrency(rates.totalLodgingAllowance)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>M&IE ({rates.days} day{rates.days !== 1 ? 's' : ''})</span>
          <span className="font-medium">{formatCurrency(rates.totalMieAllowance)}</span>
        </div>
        <div className="flex justify-between text-gray-400 text-xs">
          <span>First/last day at 75%</span>
          <span>{formatCurrency(rates.firstLastDayRate)}/day</span>
        </div>
        <div className="border-t border-gray-100 pt-2 flex justify-between">
          <span className="font-bold text-gray-900">Total Allowance</span>
          <span className="font-bold text-brand-600 text-lg">{formatCurrency(rates.totalAllowance)}</span>
        </div>
      </div>
    </div>
  );
}
