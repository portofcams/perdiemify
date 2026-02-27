'use client';

import type { PerDiemRates } from '@/types';

interface Props {
  rates: PerDiemRates & { summary?: string; friendlyTotal?: string };
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function PerDiemBreakdown({ rates }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        Per Diem Breakdown
      </h3>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Lodging rate</span>
          <span className="font-semibold text-gray-900">{fmt.format(rates.lodgingRate)}/night</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">M&IE rate</span>
          <span className="font-semibold text-gray-900">{fmt.format(rates.mieRate)}/day</span>
        </div>

        <div className="border-t border-gray-100 pt-3" />

        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Nights</span>
          <span className="font-medium text-gray-700">{rates.nights}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Days</span>
          <span className="font-medium text-gray-700">{rates.days}</span>
        </div>

        <div className="border-t border-gray-100 pt-3" />

        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Lodging allowance</span>
          <span className="font-semibold text-gray-900">{fmt.format(rates.totalLodgingAllowance)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">M&IE allowance</span>
          <span className="font-semibold text-gray-900">{fmt.format(rates.totalMieAllowance)}</span>
        </div>

        <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 mt-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-brand-700">Total allowance</span>
            <span className="text-lg font-extrabold text-brand-700">{fmt.format(rates.totalAllowance)}</span>
          </div>
        </div>
      </div>

      {rates.friendlyTotal && (
        <p className="text-xs text-gray-400 mt-3 text-center">{rates.friendlyTotal}</p>
      )}
    </div>
  );
}
