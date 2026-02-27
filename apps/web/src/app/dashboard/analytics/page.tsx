'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface TripSavings {
  name: string;
  destination: string;
  savings: number;
  date: string;
}

interface MonthlySavings {
  month: string;
  savings: number;
  cumulative: number;
  trips: number;
}

interface CategoryBreakdown {
  type: string;
  count: number;
  totalSpent: number;
  savings: number;
}

interface AnalyticsData {
  savingsByTrip: TripSavings[];
  monthlySavings: MonthlySavings[];
  categoryBreakdown: CategoryBreakdown[];
  loyaltyPoints: number;
  mealSpending: number;
  totalSavings: number;
  tripCount: number;
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444'];

export default function AnalyticsPage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const token = await getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/analytics/overview`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [getToken]);

  const hasData = data && (data.tripCount > 0 || data.savingsByTrip.length > 0);

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
            <Link href="/dashboard/analytics" className="text-sm font-medium text-brand-600">
              Analytics
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Savings Analytics</h1>
          <p className="text-gray-500 mt-1">Track your per diem savings over time.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
                <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
                <div className="h-8 w-32 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : !hasData ? (
          <div className="text-center py-20">
            <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
            <h3 className="text-xl font-bold text-gray-700 mb-2">No data yet</h3>
            <p className="text-gray-500 mb-6">Create trips and log bookings to see your savings analytics.</p>
            <Link href="/dashboard/trips" className="px-6 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors">
              Create a Trip
            </Link>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl p-5 text-white">
                <div className="text-sm text-brand-100">Total Savings</div>
                <div className="text-3xl font-bold mt-1">{fmt.format(data!.totalSavings)}</div>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="text-sm text-gray-500">Trips</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{data!.tripCount}</div>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="text-sm text-gray-500">Loyalty Points</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{data!.loyaltyPoints.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="text-sm text-gray-500">Meal Spending</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{fmt.format(data!.mealSpending)}</div>
              </div>
            </div>

            {/* Cumulative savings line chart */}
            {data!.monthlySavings.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
                <h3 className="font-bold text-gray-900 mb-4">Cumulative Savings</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data!.monthlySavings}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      formatter={(value: number) => [fmt.format(value), '']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ fill: '#10b981', r: 4 }}
                      name="Cumulative Savings"
                    />
                    <Line
                      type="monotone"
                      dataKey="savings"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: '#f59e0b', r: 3 }}
                      name="Monthly Savings"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Savings by trip bar chart */}
              {data!.savingsByTrip.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Savings by Trip</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data!.savingsByTrip}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        formatter={(value: number) => [fmt.format(value), 'Savings']}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}
                      />
                      <Bar dataKey="savings" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Category breakdown donut */}
              {data!.categoryBreakdown.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Spending by Category</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data!.categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="totalSpent"
                        nameKey="type"
                        label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                      >
                        {data!.categoryBreakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [fmt.format(value), 'Spent']}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* If no booking data, show a helpful CTA */}
            {data!.categoryBreakdown.length === 0 && (
              <div className="bg-brand-50 border border-brand-200 rounded-2xl p-6 text-center">
                <p className="text-brand-700 font-medium mb-2">Category charts will appear when you log bookings.</p>
                <p className="text-sm text-brand-600">Search for hotels, flights, or cars and your booking data will populate these charts.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
