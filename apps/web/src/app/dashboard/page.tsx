'use client';

import { useUser, UserButton } from '@clerk/nextjs';
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
  const [stats, setStats] = useState<DashboardStats>({
    totalTrips: 0,
    totalSavings: 0,
    totalSearches: 0,
    subscriptionTier: 'free',
  });

  useEffect(() => {
    // TODO: Fetch real stats from API once trip tracking is wired up
  }, []);

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
            <Link
              href="/search"
              className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors"
            >
              Search
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-brand-600"
            >
              Dashboard
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
              <button className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 text-gray-600 font-medium hover:bg-gray-100 transition-colors w-full text-left">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Per Diem Calculator
              </button>
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
