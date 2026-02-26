'use client';

import { useState } from 'react';

const features = [
  {
    icon: '🔍',
    title: 'Smart Search',
    description: 'Compare flights, hotels, and cars — sorted by how much you pocket.',
  },
  {
    icon: '💰',
    title: 'Per Diem Calculator',
    description: 'GSA, JTR, or custom rates. See your savings on every result.',
  },
  {
    icon: '🏷️',
    title: 'Discount Codes',
    description: 'We scrape the web so you don\'t have to. Auto-applied at checkout.',
  },
  {
    icon: '✈️',
    title: 'Loyalty Tracker',
    description: 'Track points across every program. Know exactly what they\'re worth.',
  },
  {
    icon: '🍽️',
    title: 'Meal Tracker',
    description: 'Log meals, track M&IE spend, pocket what\'s left.',
  },
  {
    icon: '📊',
    title: 'Savings Dashboard',
    description: 'See your total savings grow. Trip by trip, dollar by dollar.',
  },
];

export default function ComingSoonPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      // TODO: Connect to Resend or a waitlist service
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-white">
      {/* Hero */}
      <div className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
            <span className="text-gradient">Perdiemify</span>
          </h1>
          <div className="mt-2 inline-block bg-brand-100 text-brand-700 text-sm font-semibold px-3 py-1 rounded-full">
            Coming Soon
          </div>
        </div>

        {/* Tagline */}
        <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
          Keep the difference.
        </p>
        <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          The smartest way to maximize your per diem. Search travel, find deals,
          track every dollar — and pocket what you save.
        </p>

        {/* Savings teaser */}
        <div className="inline-flex items-center gap-3 bg-white border-2 border-brand-200 rounded-2xl px-6 py-4 shadow-lg mb-12">
          <div className="text-left">
            <div className="text-sm text-gray-500 font-medium">Average user saves</div>
            <div className="text-3xl font-extrabold text-brand-600">$4,200<span className="text-lg font-semibold text-gray-400">/year</span></div>
          </div>
          <div className="w-px h-12 bg-gray-200" />
          <div className="text-left">
            <div className="text-sm text-gray-500 font-medium">Per diem tracked</div>
            <div className="text-3xl font-extrabold text-accent-500">$2.1M<span className="text-lg font-semibold text-gray-400">+</span></div>
          </div>
        </div>

        {/* Email signup */}
        <div className="max-w-md mx-auto">
          {submitted ? (
            <div className="bg-brand-50 border border-brand-200 rounded-2xl p-6">
              <div className="text-2xl mb-2">🎉</div>
              <p className="text-brand-700 font-semibold text-lg">You&apos;re on the list!</p>
              <p className="text-brand-600 text-sm mt-1">We&apos;ll let you know the moment Perdiemify launches.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-gray-900 placeholder:text-gray-400 transition-all"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-brand-500/25 hover:shadow-brand-600/25"
              >
                Notify Me
              </button>
            </form>
          )}
          <p className="text-sm text-gray-400 mt-3">
            Be first to know. No spam, ever.
          </p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">
          Everything you need to maximize per diem
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-brand-200 transition-all"
            >
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{feature.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Who it's for */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">
          Built for per diem travelers
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Government / Federal', sub: 'GSA rates' },
            { label: 'Military (TDY/PCS)', sub: 'JTR rates' },
            { label: 'Corporate', sub: 'Company policy' },
            { label: 'Contractors', sub: 'Client per diem' },
          ].map((segment) => (
            <div key={segment.label} className="text-center bg-gray-50 rounded-2xl p-5">
              <div className="font-semibold text-gray-900 text-sm">{segment.label}</div>
              <div className="text-xs text-gray-400 mt-1">{segment.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        <p>&copy; {new Date().getFullYear()} Perdiemify. All rights reserved.</p>
        <p className="mt-1">Keep the difference.</p>
      </footer>
    </div>
  );
}
