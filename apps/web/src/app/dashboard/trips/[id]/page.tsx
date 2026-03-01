'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface Trip {
  id: string;
  name: string;
  destination: string;
  destinationState?: string;
  origin?: string;
  startDate: string;
  endDate: string;
  lodgingRate: string;
  mieRate: string;
  status: string;
  totalSavings: string;
  notes?: string;
}

interface Meal {
  id: string;
  date: string;
  mealType: string;
  amount: string;
  vendor: string | null;
  notes: string | null;
}

interface Receipt {
  id: string;
  status: string;
  ocrVendor: string | null;
  ocrAmount: string | null;
  ocrDate: string | null;
  ocrCategory: string | null;
  isVerified: boolean;
  createdAt: string;
}

interface ComplianceDay {
  date: string;
  lodgingSpent: number;
  lodgingAllowance: number;
  mieSpent: number;
  mieAllowance: number;
  totalSpent: number;
  totalAllowance: number;
  delta: number;
}

interface ComplianceData {
  trip: { lodgingRate: number; mieRate: number };
  days: ComplianceDay[];
  totals: { totalAllowance: number; totalSpent: number; delta: number; receiptCount: number; verifiedCount: number };
}

interface PriceAlert {
  id: string;
  destination: string;
  checkIn: string;
  checkOut: string;
  targetPrice: string;
  isActive: boolean;
  tripId: string | null;
}

type Tab = 'overview' | 'meals' | 'receipts' | 'compliance' | 'alerts';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtDec = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function daysBetween(start: string, end: string) {
  return Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000));
}

function statusColor(status: string) {
  switch (status) {
    case 'active': return 'bg-brand-50 text-brand-700 border-brand-200';
    case 'completed': return 'bg-gray-100 text-gray-600 border-gray-200';
    case 'cancelled': return 'bg-red-50 text-red-600 border-red-200';
    default: return 'bg-gray-50 text-gray-500 border-gray-200';
  }
}

const mealTypeColor: Record<string, string> = {
  breakfast: 'bg-amber-50 text-amber-700',
  lunch: 'bg-blue-50 text-blue-700',
  dinner: 'bg-purple-50 text-purple-700',
  snack: 'bg-gray-100 text-gray-600',
};

const categoryColors: Record<string, string> = {
  lodging: 'bg-purple-50 text-purple-700',
  meals: 'bg-amber-50 text-amber-700',
  transport: 'bg-blue-50 text-blue-700',
  parking: 'bg-teal-50 text-teal-700',
  tips: 'bg-pink-50 text-pink-700',
  other: 'bg-gray-100 text-gray-600',
};

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchAll = useCallback(async () => {
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [tripRes, mealsRes, receiptsRes, complianceRes, alertsRes] = await Promise.all([
        fetch(`${apiUrl}/api/trips/${id}`, { headers }),
        fetch(`${apiUrl}/api/meals?tripId=${id}`, { headers }),
        fetch(`${apiUrl}/api/receipts?tripId=${id}`, { headers }),
        fetch(`${apiUrl}/api/receipts/compliance?tripId=${id}`, { headers }),
        fetch(`${apiUrl}/api/alerts`, { headers }),
      ]);

      const [tripData, mealsData, receiptsData, complianceData, alertsData] = await Promise.all([
        tripRes.json(), mealsRes.json(), receiptsRes.json(), complianceRes.json(), alertsRes.json(),
      ]);

      if (tripData.success) setTrip(tripData.data);
      else setError('Trip not found');
      if (mealsData.success) setMeals(mealsData.data || []);
      if (receiptsData.success) setReceipts(receiptsData.data || []);
      if (complianceData.success) setCompliance(complianceData.data);
      if (alertsData.success) {
        setAlerts((alertsData.data || []).filter((a: PriceAlert) => a.tripId === id));
      }
    } catch {
      setError('Failed to load trip data');
    } finally {
      setLoading(false);
    }
  }, [id, getToken, apiUrl]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Trip Not Found</h2>
        <p className="text-gray-500 mb-4">{error || 'This trip does not exist.'}</p>
        <Link href="/dashboard/trips" className="text-brand-600 font-medium hover:underline">
          Back to Trips
        </Link>
      </div>
    );
  }

  const nights = daysBetween(trip.startDate, trip.endDate);
  const totalAllowance = nights * Number(trip.lodgingRate) + (nights + 1) * Number(trip.mieRate);
  const savings = Number(trip.totalSavings || 0);
  const totalMealSpent = meals.reduce((s, m) => s + Number(m.amount), 0);
  const totalReceiptAmount = receipts.filter(r => r.ocrAmount).reduce((s, r) => s + Number(r.ocrAmount), 0);

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'meals', label: 'Meals', count: meals.length },
    { key: 'receipts', label: 'Receipts', count: receipts.length },
    { key: 'compliance', label: 'Compliance' },
    { key: 'alerts', label: 'Alerts', count: alerts.length },
  ];

  return (
    <>
      {/* Back link */}
      <Link href="/dashboard/trips" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to Trips
      </Link>

      {/* Trip header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{trip.name}</h1>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${statusColor(trip.status)}`}>
                {trip.status}
              </span>
            </div>
            <p className="text-gray-500">
              {trip.destination}{trip.destinationState ? `, ${trip.destinationState}` : ''}
              {trip.origin && <span className="text-gray-400"> from {trip.origin}</span>}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {new Date(trip.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {' — '}
              {new Date(trip.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <Link
            href="/dashboard/trips"
            className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors shrink-0"
          >
            Edit Trip
          </Link>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Nights</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">{nights}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Lodging</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">{fmt.format(Number(trip.lodgingRate))}/night</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">M&IE</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">{fmt.format(Number(trip.mieRate))}/day</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Allowance</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">{fmt.format(totalAllowance)}</div>
          </div>
          {savings > 0 && (
            <div>
              <div className="text-xs text-brand-600 uppercase tracking-wider font-semibold">Savings</div>
              <div className="text-lg font-bold text-brand-600 mt-0.5">+{fmt.format(savings)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-full border whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                activeTab === tab.key ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {trip.notes && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-2">Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{trip.notes}</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="text-sm text-gray-500">Meals Logged</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{meals.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">{fmtDec.format(totalMealSpent)} spent</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="text-sm text-gray-500">Receipts</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{receipts.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">{fmtDec.format(totalReceiptAmount)} tracked</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="text-sm text-gray-500">Price Alerts</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{alerts.filter(a => a.isActive).length}</div>
              <div className="text-xs text-gray-400 mt-0.5">{alerts.length} total</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'meals' && (
        <div>
          {meals.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <p className="text-gray-500 mb-3">No meals logged for this trip yet.</p>
              <Link href="/dashboard/meals" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                Go to Meal Tracker
              </Link>
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
                  <div className="font-bold text-gray-900 text-sm">{fmtDec.format(Number(meal.amount))}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'receipts' && (
        <div>
          {receipts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <p className="text-gray-500 mb-3">No receipts for this trip yet.</p>
              <Link href="/dashboard/receipts" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                Go to Receipts
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {receipts.map(receipt => (
                <div key={receipt.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                  {receipt.isVerified ? (
                    <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-brand-50 text-brand-700">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      Verified
                    </span>
                  ) : (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      receipt.status === 'processing' ? 'bg-amber-50 text-amber-700' :
                      receipt.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {receipt.status}
                    </span>
                  )}
                  {receipt.ocrCategory && (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${categoryColors[receipt.ocrCategory] || categoryColors.other}`}>
                      {receipt.ocrCategory}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{receipt.ocrVendor || 'Pending...'}</div>
                    <div className="text-xs text-gray-400">
                      {receipt.ocrDate
                        ? new Date(receipt.ocrDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                        : new Date(receipt.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="font-bold text-gray-900 text-sm">
                    {receipt.ocrAmount ? fmtDec.format(Number(receipt.ocrAmount)) : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'compliance' && (
        <div>
          {!compliance || compliance.days.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <p className="text-gray-500">No compliance data yet. Upload receipts to track per diem compliance.</p>
            </div>
          ) : (
            <>
              {/* Totals */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <div className="text-sm text-gray-500">Total Allowance</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{fmtDec.format(compliance.totals.totalAllowance)}</div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <div className="text-sm text-gray-500">Total Spent</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{fmtDec.format(compliance.totals.totalSpent)}</div>
                </div>
                <div className={`rounded-2xl p-5 border shadow-sm ${
                  compliance.totals.delta >= 0 ? 'bg-brand-50 border-brand-200' : 'bg-red-50 border-red-200'
                }`}>
                  <div className={`text-sm ${compliance.totals.delta >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
                    {compliance.totals.delta >= 0 ? 'Under Budget' : 'Over Budget'}
                  </div>
                  <div className={`text-2xl font-bold mt-1 ${compliance.totals.delta >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
                    {fmtDec.format(Math.abs(compliance.totals.delta))}
                  </div>
                </div>
              </div>

              {/* Daily table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Date</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Lodging</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600">L. Rate</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600">M&IE</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600">M&IE Rate</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Total</th>
                        <th className="text-right px-5 py-2.5 font-semibold text-gray-600">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compliance.days.map(day => (
                        <tr key={day.date} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-5 py-2.5 font-medium text-gray-900">
                            {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-900">{fmtDec.format(day.lodgingSpent)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-400">{fmtDec.format(day.lodgingAllowance)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-900">{fmtDec.format(day.mieSpent)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-400">{fmtDec.format(day.mieAllowance)}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-gray-900">{fmtDec.format(day.totalSpent)}</td>
                          <td className={`px-5 py-2.5 text-right font-semibold ${day.delta >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
                            {day.delta >= 0 ? '+' : ''}{fmtDec.format(day.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div>
          {alerts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <p className="text-gray-500 mb-3">No price alerts for this trip.</p>
              <p className="text-xs text-gray-400">Price alerts monitor hotel rates and notify you when prices drop.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map(alert => (
                <div key={alert.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                  <div className={`w-2.5 h-2.5 rounded-full ${alert.isActive ? 'bg-brand-500' : 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{alert.destination}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(alert.checkIn + 'T00:00:00').toLocaleDateString()} — {new Date(alert.checkOut + 'T00:00:00').toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-gray-900">Target: {fmt.format(Number(alert.targetPrice))}</div>
                    <div className={`text-xs ${alert.isActive ? 'text-brand-600' : 'text-gray-400'}`}>
                      {alert.isActive ? 'Active' : 'Paused'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
