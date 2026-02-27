'use client';

import { useUser, useAuth, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useState, useEffect } from 'react';

interface DashboardStats {
  totalTrips: number;
  totalSavings: number;
  totalSearches: number;
  subscriptionTier: string;
}

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalTrips: 0,
    totalSavings: 0,
    totalSearches: 0,
    subscriptionTier: 'free',
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const token = await getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/users/me/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.data) {
          setStats({
            totalTrips: data.data.totalTrips ?? 0,
            totalSavings: data.data.totalSavings ?? 0,
            totalSearches: data.data.totalSearches ?? 0,
            subscriptionTier: data.data.subscriptionTier ?? 'free',
          });
        }
      } catch {
        // silent — keep defaults
      }
    }
    fetchStats();
  }, [getToken]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard Nav */}
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-500 to-brand-700">
              Perdiemify
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/search" className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors">
              Search
            </Link>
            <Link href="/dashboard" className="text-sm font-medium text-brand-600">
              Dashboard
            </Link>
            <Link href="/dashboard/trips" className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors hidden sm:block">
              Trips
            </Link>
            <Link href="/dashboard/loyalty" className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors hidden sm:block">
              Loyalty
            </Link>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.firstName || 'Traveler'}
          </h1>
          <p className="text-gray-500 mt-1">
            Track your per diem savings and manage your trips.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Total Trips',
              value: stats.totalTrips.toString(),
              icon: '✈️',
              color: 'brand',
            },
            {
              label: 'Total Savings',
              value: `$${stats.totalSavings.toLocaleString()}`,
              icon: '💰',
              color: 'brand',
            },
            {
              label: 'Searches',
              value: stats.totalSearches.toString(),
              icon: '🔍',
              color: 'accent',
            },
            {
              label: 'Plan',
              value: stats.subscriptionTier === 'free' ? 'Free' : stats.subscriptionTier === 'pro' ? 'Pro' : 'Pro+',
              icon: '⭐',
              color: 'accent',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
            >
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link
                href="/search"
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-50 text-brand-700 font-medium hover:bg-brand-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                Search Hotels, Flights & Cars
              </Link>
              <Link
                href="/dashboard/trips"
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 text-gray-600 font-medium hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
                Manage Trips
              </Link>
              <Link
                href="/dashboard/loyalty"
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 text-gray-600 font-medium hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                </svg>
                Loyalty Tracker
              </Link>
              <Link
                href="/dashboard/deals"
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 text-gray-600 font-medium hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                </svg>
                Discount Codes
              </Link>
              <Link
                href="/dashboard/meals"
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 text-gray-600 font-medium hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75-1.5.75a3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0L3 16.5m15-3.379a48.474 48.474 0 0 0-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 0 1 3 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 0 1 6 13.12M12.265 3.11a.375.375 0 1 1-.53 0L12 2.845l.265.265Z" />
                </svg>
                Meal Tracker
              </Link>
              <Link
                href="/calculator"
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 text-gray-600 font-medium hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Per Diem Calculator
              </Link>
            </div>
          </div>

          {/* Upgrade CTA for free users */}
          {stats.subscriptionTier === 'free' && (
            <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl p-6 text-white">
              <h2 className="text-lg font-bold mb-2">Upgrade to Pro</h2>
              <p className="text-brand-100 text-sm mb-4">
                Unlock unlimited searches, loyalty tracking, meal tracker, and savings dashboard.
              </p>
              <ul className="space-y-2 text-sm text-brand-100 mb-6">
                {['Unlimited searches', 'Loyalty point tracking', 'Meal & M&IE tracker', 'Savings dashboard'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard/billing"
                className="inline-block px-6 py-2.5 bg-white text-brand-600 font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-lg"
              >
                Upgrade — $9.99/mo
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
