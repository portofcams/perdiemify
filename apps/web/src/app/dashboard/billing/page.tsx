'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useState } from 'react';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: ['5 searches per day', 'Per diem calculator', 'GSA rate lookup', 'Basic hotel results'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    period: '/month',
    popular: true,
    features: [
      'Unlimited searches',
      'Discount code alerts',
      'Loyalty point tracking',
      'Meal & M&IE tracker',
      'Savings dashboard',
      'Email trip summaries',
    ],
  },
  {
    id: 'proplus',
    name: 'Pro+',
    price: '$19.99',
    period: '/month',
    features: [
      'Everything in Pro',
      'AI trip planner',
      'Priority deal alerts',
      'Custom per diem rates',
      'Team/org dashboard',
      'API access',
    ],
  },
];

export default function BillingPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentPlan = 'free'; // TODO: Fetch from API

  const handleUpgrade = async (planId: string) => {
    if (planId === 'free') return;

    setLoading(planId);
    setError(null);

    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const res = await fetch(`${apiUrl}/api/billing/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planId }),
      });

      const data = await res.json();

      if (data.success && data.data?.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
      } else {
        setError(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(null);
    }
  };

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
            <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-brand-600">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">Choose Your Plan</h1>
          <p className="mt-2 text-gray-500">
            Upgrade to unlock unlimited searches and premium features.
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-6 border-2 bg-white ${
                plan.popular
                  ? 'border-brand-500 shadow-xl shadow-brand-500/10 scale-[1.02]'
                  : 'border-gray-100 shadow-sm'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                  Most Popular
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-400 font-medium">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {plan.id === currentPlan ? (
                <div className="w-full py-3 text-sm font-semibold rounded-xl bg-gray-100 text-gray-500 text-center">
                  Current Plan
                </div>
              ) : plan.id === 'free' ? (
                <div className="w-full py-3 text-sm font-semibold rounded-xl bg-gray-50 text-gray-400 text-center">
                  Free Tier
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={loading === plan.id}
                  className={`w-full py-3 text-sm font-semibold rounded-xl transition-all ${
                    plan.popular
                      ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/25'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading === plan.id ? 'Redirecting...' : `Upgrade to ${plan.name}`}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
