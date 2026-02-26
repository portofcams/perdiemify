'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { PerDiemRates } from '@/types';

interface PerDiemCalcParams {
  city: string;
  state: string;
  checkIn: string;
  checkOut: string;
  perDiemSource?: string;
  customLodgingRate?: number;
  customMieRate?: number;
}

interface PerDiemCalcResponse extends PerDiemRates {
  summary: string;
  friendlyTotal: string;
}

export function usePerDiem() {
  const [rates, setRates] = useState<PerDiemCalcResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calculate(params: PerDiemCalcParams) {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<PerDiemCalcResponse>('/api/perdiem/calculate', {
        method: 'POST',
        body: JSON.stringify(params),
      });

      if (res.success && res.data) {
        setRates(res.data);
      } else {
        setError(res.error || 'Failed to calculate per diem');
      }
    } catch {
      setError('Network error — could not reach API');
    } finally {
      setLoading(false);
    }
  }

  return { rates, loading, error, calculate };
}
