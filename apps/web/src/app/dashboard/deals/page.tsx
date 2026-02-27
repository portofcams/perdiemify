'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface DiscountCode {
  id: string;
  code: string;
  provider: string;
  type: string;
  value: string | null;
  description: string | null;
  source: string;
  applicableTo: string;
  expiresAt: string | null;
  isValidated: boolean;
  upvotes: number;
  downvotes: number;
  createdAt: string;
}

const typeLabel: Record<string, string> = {
  percent: '% Off',
  fixed: '$ Off',
  promo: 'Promo',
  gov: 'Gov Rate',
};

const typeColor: Record<string, string> = {
  percent: 'bg-brand-50 text-brand-700',
  fixed: 'bg-accent-50 text-accent-700',
  promo: 'bg-purple-50 text-purple-700',
  gov: 'bg-blue-50 text-blue-700',
};

const categoryFilters = [
  { value: '', label: 'All' },
  { value: 'hotel', label: 'Hotels' },
  { value: 'flight', label: 'Flights' },
  { value: 'car', label: 'Cars' },
  { value: 'all', label: 'Universal' },
];

export default function DealsPage() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    async function fetchDeals() {
      try {
        const params = new URLSearchParams();
        if (filter) params.set('type', filter);
        const res = await fetch(`${apiUrl}/api/deals?${params}`);
        const data = await res.json();
        if (data.success) setCodes(data.data);
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    }
    fetchDeals();
  }, [filter, apiUrl]);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleVote = async (id: string, direction: 'up' | 'down') => {
    try {
      await fetch(`${apiUrl}/api/deals/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      });
      setCodes(prev => prev.map(c =>
        c.id === id
          ? { ...c, upvotes: c.upvotes + (direction === 'up' ? 1 : 0), downvotes: c.downvotes + (direction === 'down' ? 1 : 0) }
          : c
      ));
    } catch {
      // silent
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
            <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors">
              Dashboard
            </Link>
            <Link href="/dashboard/deals" className="text-sm font-medium text-brand-600">
              Deals
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Discount Codes & Deals</h1>
          <p className="text-gray-500 mt-1">
            Save even more on your per diem travel with verified codes and gov rates.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categoryFilters.map(f => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); setLoading(true); }}
              className={`px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
                filter === f.value
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Gov rates callout */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-blue-900">Government & Military Rates</h3>
              <p className="text-sm text-blue-700 mt-0.5">
                Federal employees and military personnel — use these codes at major hotel chains for guaranteed per diem rates.
              </p>
            </div>
          </div>
        </div>

        {/* Codes list */}
        {loading ? (
          <div className="space-y-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="h-12 w-24 bg-gray-200 rounded-xl" />
                  <div className="flex-1">
                    <div className="h-5 w-40 bg-gray-200 rounded mb-2" />
                    <div className="h-4 w-64 bg-gray-100 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : codes.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-700">No deals found</h3>
            <p className="text-gray-500 mt-1">Check back soon — our scraper runs every 4 hours.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {codes.map((code) => (
              <div key={code.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Code box */}
                  <button
                    onClick={() => handleCopy(code.code, code.id)}
                    className="shrink-0 px-4 py-2.5 bg-gray-900 text-white font-mono text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors min-w-[120px] text-center"
                    title="Click to copy"
                  >
                    {copiedId === code.id ? 'Copied!' : code.code}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">{code.provider}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColor[code.type] || 'bg-gray-100 text-gray-600'}`}>
                        {code.value && code.type === 'percent' ? `${code.value}%` : code.value && code.type === 'fixed' ? `$${code.value}` : typeLabel[code.type] || code.type}
                      </span>
                      {code.applicableTo !== 'all' && (
                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                          {code.applicableTo}
                        </span>
                      )}
                    </div>
                    {code.description && (
                      <p className="text-sm text-gray-500 truncate">{code.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span>Source: {code.source}</span>
                      {code.expiresAt && (
                        <span>Expires: {new Date(code.expiresAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  {/* Votes */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleVote(code.id, 'up')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                      </svg>
                      {code.upvotes}
                    </button>
                    <button
                      onClick={() => handleVote(code.id, 'down')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                      {code.downvotes}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
