'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

interface DiscountCode {
  id: string;
  code: string;
  provider: string;
  type: string;
  value: string | null;
  description: string | null;
  source: string;
  source_url: string | null;
  applicable_to: string;
  expires_at: string | null;
  is_validated: boolean;
  success_rate: string;
  upvotes: number;
  downvotes: number;
  submitted_by: string | null;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

const sortOptions = [
  { value: 'upvotes', label: 'Most Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'success_rate', label: 'Highest Rated' },
];

export default function DealsPage() {
  const { getToken } = useAuth();
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('upvotes');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 30, total: 0, totalPages: 0 });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchDeals = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('type', filter);
      if (search) params.set('search', search);
      if (sort) params.set('sort', sort);
      if (verifiedOnly) params.set('verified', 'true');
      params.set('page', String(page));
      params.set('limit', '30');

      const res = await fetch(`${apiUrl}/api/deals?${params}`);
      const data = await res.json();
      if (data.success) {
        setCodes(data.data);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [filter, search, sort, verifiedOnly, apiUrl]);

  useEffect(() => {
    fetchDeals(1);
  }, [fetchDeals]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

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
        body: JSON.stringify({ vote: direction }),
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

  const successColor = (rate: string) => {
    const r = parseFloat(rate);
    if (r >= 0.7) return 'text-green-600';
    if (r >= 0.4) return 'text-yellow-600';
    return 'text-red-500';
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Discount Codes & Deals</h1>
            <p className="text-gray-500 mt-1">
              Save even more on your per diem travel with verified codes and gov rates.
            </p>
          </div>
          <button
            onClick={() => setShowSubmitModal(true)}
            className="shrink-0 px-5 py-2.5 bg-brand-500 text-white text-sm font-semibold rounded-xl hover:bg-brand-600 transition-colors shadow-sm"
          >
            + Submit a Code
          </button>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search codes, providers, descriptions..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <button type="submit" className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors">
              Search
            </button>
          </div>
        </form>

        {/* Filters row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            {categoryFilters.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
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
          <div className="flex items-center gap-3 sm:ml-auto">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {sortOptions.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
              />
              Verified only
            </label>
          </div>
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

        {/* Results count */}
        {!loading && (
          <p className="text-sm text-gray-400 mb-4">
            {pagination.total} deal{pagination.total !== 1 ? 's' : ''} found
            {search && <span> for &ldquo;{search}&rdquo;</span>}
          </p>
        )}

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
            <p className="text-gray-500 mt-1">Try different filters or submit your own codes!</p>
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
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-gray-900">{code.provider}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColor[code.type] || 'bg-gray-100 text-gray-600'}`}>
                        {code.value && code.type === 'percent' ? `${code.value}%` : code.value && code.type === 'fixed' ? `$${code.value}` : typeLabel[code.type] || code.type}
                      </span>
                      {code.applicable_to !== 'all' && (
                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                          {code.applicable_to}
                        </span>
                      )}
                      {code.is_validated && (
                        <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Verified
                        </span>
                      )}
                      {code.source === 'community' && (
                        <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Community</span>
                      )}
                    </div>
                    {code.description && (
                      <p className="text-sm text-gray-500 truncate">{code.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span>Source: {code.source}</span>
                      {parseFloat(code.success_rate) > 0 && (
                        <span className={successColor(code.success_rate)}>
                          {Math.round(parseFloat(code.success_rate) * 100)}% success
                        </span>
                      )}
                      {code.expires_at && (
                        <span>Expires: {new Date(code.expires_at).toLocaleDateString()}</span>
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

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <button
              onClick={() => fetchDeals(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500 px-3">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => fetchDeals(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        )}

      {/* Submit Code Modal */}
      {showSubmitModal && (
        <SubmitCodeModal
          apiUrl={apiUrl}
          getToken={getToken}
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={() => {
            setShowSubmitModal(false);
            fetchDeals(1);
          }}
        />
      )}
    </>
  );
}

// ─── Submit Code Modal ──────────────────────────────────────────

function SubmitCodeModal({
  apiUrl,
  getToken,
  onClose,
  onSubmitted,
}: {
  apiUrl: string;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [form, setForm] = useState({
    code: '',
    provider: '',
    type: 'promo',
    value: '',
    description: '',
    applicableTo: 'all',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.code.trim() || !form.provider.trim()) {
      setError('Code and provider are required');
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        setError('You must be signed in to submit codes. Please sign in first.');
        setSubmitting(false);
        return;
      }

      const res = await fetch(`${apiUrl}/api/deals/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          value: form.value ? parseFloat(form.value) : null,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to submit code');
        return;
      }

      onSubmitted();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Submit a Discount Code</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discount Code *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="e.g. SAVE20"
              maxLength={50}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              required
            />
          </div>

          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider *</label>
            <input
              type="text"
              value={form.provider}
              onChange={(e) => setForm(prev => ({ ...prev, provider: e.target.value }))}
              placeholder="e.g. Marriott, Hotels.com, Enterprise"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              required
            />
          </div>

          {/* Type & Value row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="promo">Promo Code</option>
                <option value="percent">Percent Off</option>
                <option value="fixed">Dollar Off</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value (optional)</label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm(prev => ({ ...prev, value: e.target.value }))}
                placeholder={form.type === 'percent' ? '20' : '50'}
                min="0"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Applies to</label>
            <select
              value={form.applicableTo}
              onChange={(e) => setForm(prev => ({ ...prev, applicableTo: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All travel</option>
              <option value="hotel">Hotels</option>
              <option value="flight">Flights</option>
              <option value="car">Car Rental</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="How does this code work? Any restrictions?"
              rows={3}
              maxLength={500}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm font-semibold bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
