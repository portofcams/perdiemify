'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  mieRate: string;
}

interface Meal {
  id: string;
  tripId: string;
  date: string;
  mealType: string;
  amount: string;
  vendor: string | null;
  notes: string | null;
}

interface DailyBreakdown {
  date: string;
  spent: number;
  allowance: number;
  remaining: number;
  mealCount: number;
}

interface MealSummary {
  totalSpent: number;
  totalAllowance: number;
  remaining: number;
  mealCount: number;
  tripDays: number;
  mieRate: number;
  dailyBreakdown: DailyBreakdown[];
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const mealTypes = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack/Other' },
];

const mealTypeColor: Record<string, string> = {
  breakfast: 'bg-amber-50 text-amber-700',
  lunch: 'bg-blue-50 text-blue-700',
  dinner: 'bg-purple-50 text-purple-700',
  snack: 'bg-gray-100 text-gray-600',
};

export default function MealsPage() {
  const { getToken } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<string>('');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [summary, setSummary] = useState<MealSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Fetch trips for the dropdown
  useEffect(() => {
    async function fetchTrips() {
      try {
        const token = await getToken();
        const res = await fetch(`${apiUrl}/api/trips`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          setTrips(data.data);
          setSelectedTrip(data.data[0].id);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchTrips();
  }, [getToken, apiUrl]);

  // Fetch meals + summary when trip changes
  const fetchMeals = useCallback(async () => {
    if (!selectedTrip) return;
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [mealsRes, summaryRes] = await Promise.all([
        fetch(`${apiUrl}/api/meals?tripId=${selectedTrip}`, { headers }),
        fetch(`${apiUrl}/api/meals/summary?tripId=${selectedTrip}`, { headers }),
      ]);
      const [mealsData, summaryData] = await Promise.all([mealsRes.json(), summaryRes.json()]);
      if (mealsData.success) setMeals(mealsData.data);
      if (summaryData.success) setSummary(summaryData.data);
    } catch {
      setError('Failed to load meal data');
    }
  }, [selectedTrip, getToken, apiUrl]);

  useEffect(() => { fetchMeals(); }, [fetchMeals]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      tripId: selectedTrip,
      date: form.get('date'),
      mealType: form.get('mealType'),
      amount: Number(form.get('amount')),
      vendor: form.get('vendor') || null,
      notes: form.get('notes') || null,
    };

    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/meals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        fetchMeals();
      } else {
        setError(data.error || 'Failed to save meal');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = await getToken();
      await fetch(`${apiUrl}/api/meals/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchMeals();
    } catch {
      setError('Failed to delete');
    }
  };

  const currentTrip = trips.find(t => t.id === selectedTrip);

  // Calculate today's date as default
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-500 to-brand-700">
              Perdiemify
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors">
              Dashboard
            </Link>
            <Link href="/dashboard/meals" className="text-sm font-medium text-brand-600">
              Meals
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meal & M&IE Tracker</h1>
            <p className="text-gray-500 mt-1">Track your meal spending against your per diem allowance.</p>
          </div>
          {selectedTrip && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/25"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Log Meal
            </button>
          )}
        </div>

        {/* Trip selector */}
        {trips.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Trip</label>
            <select
              value={selectedTrip}
              onChange={(e) => setSelectedTrip(e.target.value)}
              className="w-full sm:w-80 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm"
            >
              {trips.map(t => (
                <option key={t.id} value={t.id}>{t.name} — {t.destination}</option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="h-5 w-48 bg-gray-200 rounded mb-3" />
                <div className="h-4 w-32 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No trips yet</h3>
            <p className="text-gray-500 mb-4">Create a trip first to start tracking meals.</p>
            <Link href="/dashboard/trips"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors">
              Go to Trips
            </Link>
          </div>
        ) : (
          <>
            {/* M&IE Summary Cards */}
            {summary && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <div className="text-sm text-gray-500">M&IE Rate</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{fmt.format(summary.mieRate)}/day</div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <div className="text-sm text-gray-500">Total Allowance</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{fmt.format(summary.totalAllowance)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{summary.tripDays} days</div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <div className="text-sm text-gray-500">Spent</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{fmt.format(summary.totalSpent)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{summary.mealCount} meals logged</div>
                </div>
                <div className={`rounded-2xl p-5 border shadow-sm ${
                  summary.remaining >= 0
                    ? 'bg-brand-50 border-brand-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className={`text-sm ${summary.remaining >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
                    {summary.remaining >= 0 ? 'Remaining (you keep this!)' : 'Over budget'}
                  </div>
                  <div className={`text-2xl font-bold mt-1 ${summary.remaining >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
                    {fmt.format(Math.abs(summary.remaining))}
                  </div>
                </div>
              </div>
            )}

            {/* Progress bar */}
            {summary && summary.totalAllowance > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">M&IE Budget Used</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {Math.round((summary.totalSpent / summary.totalAllowance) * 100)}%
                  </span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      summary.totalSpent / summary.totalAllowance > 1 ? 'bg-red-500' :
                      summary.totalSpent / summary.totalAllowance > 0.75 ? 'bg-accent-500' : 'bg-brand-500'
                    }`}
                    style={{ width: `${Math.min(100, (summary.totalSpent / summary.totalAllowance) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Daily breakdown */}
            {summary && summary.dailyBreakdown.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-8 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">Daily Breakdown</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Date</th>
                      <th className="text-right px-5 py-2.5 font-semibold text-gray-600">Spent</th>
                      <th className="text-right px-5 py-2.5 font-semibold text-gray-600">Allowance</th>
                      <th className="text-right px-5 py-2.5 font-semibold text-gray-600">Remaining</th>
                      <th className="text-right px-5 py-2.5 font-semibold text-gray-600">Meals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.dailyBreakdown.map(day => (
                      <tr key={day.date} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-5 py-2.5 font-medium text-gray-900">
                          {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-5 py-2.5 text-right text-gray-900">{fmt.format(day.spent)}</td>
                        <td className="px-5 py-2.5 text-right text-gray-500">{fmt.format(day.allowance)}</td>
                        <td className={`px-5 py-2.5 text-right font-semibold ${day.remaining >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
                          {day.remaining >= 0 ? '+' : ''}{fmt.format(day.remaining)}
                        </td>
                        <td className="px-5 py-2.5 text-right text-gray-500">{day.mealCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add meal form modal */}
            {showForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-gray-900">Log Meal</h2>
                    <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                        <input name="date" type="date" required defaultValue={today}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Meal Type</label>
                        <select name="mealType" required
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm">
                          {mealTypes.map(mt => (
                            <option key={mt.value} value={mt.value}>{mt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                      <input name="amount" type="number" step="0.01" min="0" required placeholder="12.50"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vendor (optional)</label>
                      <input name="vendor" placeholder="e.g. Chipotle"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                      <input name="notes" placeholder="Team lunch, client meeting, etc."
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button type="submit" disabled={saving}
                        className="flex-1 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors disabled:opacity-50">
                        {saving ? 'Saving...' : 'Log Meal'}
                      </button>
                      <button type="button" onClick={() => setShowForm(false)}
                        className="px-6 py-2.5 bg-gray-100 text-gray-600 font-medium rounded-xl hover:bg-gray-200 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Meal entries list */}
            <h3 className="font-bold text-gray-900 mb-4">
              Meal Log {meals.length > 0 && <span className="font-normal text-gray-400">({meals.length})</span>}
            </h3>
            {meals.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                <p className="text-gray-500 mb-3">No meals logged for this trip yet.</p>
                <button onClick={() => setShowForm(true)}
                  className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                  Log your first meal
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {meals.map(meal => (
                  <div key={meal.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${mealTypeColor[meal.mealType] || 'bg-gray-100 text-gray-600'}`}>
                      {meal.mealType}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {meal.vendor || meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(meal.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {meal.notes && ` — ${meal.notes}`}
                      </div>
                    </div>
                    <div className="font-bold text-gray-900 text-sm">{fmt.format(Number(meal.amount))}</div>
                    <button onClick={() => handleDelete(meal.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
