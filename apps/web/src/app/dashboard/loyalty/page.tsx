'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

interface LoyaltyAccount {
  id: string;
  programName: string;
  programCategory: string;
  accountNumber?: string;
  pointsBalance: number;
  statusLevel?: string;
  statusProgress: number;
  estimatedValueUsd?: number;
  marketPointValue?: string | null;
  bestRedemptionType?: string | null;
}

interface PortfolioSummary {
  totalPoints: number;
  estimatedValueUsd: number;
  programCount: number;
}

interface Valuation {
  programName: string;
  pointValueCents: string;
  bestRedemptionType: string | null;
  source: string | null;
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const categoryColors: Record<string, string> = {
  hotel: 'bg-brand-50 text-brand-700',
  airline: 'bg-blue-50 text-blue-700',
  car: 'bg-accent-50 text-accent-700',
  credit_card: 'bg-purple-50 text-purple-700',
  other: 'bg-gray-100 text-gray-600',
};

const PROGRAMS: Record<string, string[]> = {
  hotel: ['Marriott Bonvoy', 'Hilton Honors', 'IHG One Rewards', 'World of Hyatt', 'Wyndham Rewards', 'Best Western Rewards', 'Choice Privileges', 'Radisson Rewards'],
  airline: ['Delta SkyMiles', 'United MileagePlus', 'American AAdvantage', 'Southwest Rapid Rewards', 'JetBlue TrueBlue', 'Alaska Mileage Plan'],
  car: ['National Emerald Club', 'Hertz Gold Plus', 'Enterprise Plus', 'Avis Preferred'],
  credit_card: ['Chase Ultimate Rewards', 'Amex Membership Rewards', 'Citi ThankYou', 'Capital One Miles', 'Bilt Rewards'],
};

export default function LoyaltyPage() {
  const { getToken } = useAuth();
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary>({ totalPoints: 0, estimatedValueUsd: 0, programCount: 0 });
  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<LoyaltyAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('hotel');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchData = useCallback(async () => {
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [acctRes, sumRes, valRes] = await Promise.all([
        fetch(`${apiUrl}/api/loyalty/accounts`, { headers }),
        fetch(`${apiUrl}/api/loyalty/summary`, { headers }),
        fetch(`${apiUrl}/api/loyalty/valuations`),
      ]);

      const [acctData, sumData, valData] = await Promise.all([
        acctRes.json(), sumRes.json(), valRes.json(),
      ]);

      if (acctData.success) setAccounts(acctData.data);
      if (sumData.success) setSummary(sumData.data);
      if (valData.success) setValuations(valData.data);
    } catch {
      setError('Failed to load loyalty data');
    } finally {
      setLoading(false);
    }
  }, [getToken, apiUrl]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      programName: form.get('programName'),
      programCategory: form.get('programCategory'),
      accountNumber: form.get('accountNumber') || null,
      pointsBalance: Number(form.get('pointsBalance') || 0),
      statusLevel: form.get('statusLevel') || null,
    };

    try {
      const token = await getToken();
      const url = editingAccount
        ? `${apiUrl}/api/loyalty/accounts/${editingAccount.id}`
        : `${apiUrl}/api/loyalty/accounts`;
      const res = await fetch(url, {
        method: editingAccount ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        setEditingAccount(null);
        fetchData();
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this loyalty account?')) return;
    try {
      const token = await getToken();
      await fetch(`${apiUrl}/api/loyalty/accounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchData();
    } catch {
      setError('Failed to remove account');
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
            <Link href="/dashboard/loyalty" className="text-sm font-medium text-brand-600">
              Loyalty
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Loyalty Tracker</h1>
            <p className="text-gray-500 mt-1">
              Track your points, miles, and rewards across all programs.
            </p>
          </div>
          <button
            onClick={() => { setEditingAccount(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/25"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Account
          </button>
        </div>

        {/* Portfolio summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl p-5 text-white">
            <div className="text-sm text-brand-100">Portfolio Value</div>
            <div className="text-3xl font-bold mt-1">{fmt.format(summary.estimatedValueUsd)}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="text-sm text-gray-500">Total Points/Miles</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary.totalPoints.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="text-sm text-gray-500">Programs</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary.programCount}</div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingAccount ? 'Edit Account' : 'Add Loyalty Account'}
                </h2>
                <button onClick={() => { setShowForm(false); setEditingAccount(null); }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    name="programCategory"
                    value={editingAccount?.programCategory || selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm"
                  >
                    <option value="hotel">Hotel</option>
                    <option value="airline">Airline</option>
                    <option value="car">Car Rental</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
                  {editingAccount ? (
                    <input name="programName" readOnly value={editingAccount.programName}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500" />
                  ) : (
                    <select name="programName" required
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm">
                      <option value="">Select program...</option>
                      {(PROGRAMS[selectedCategory] || []).map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                      <option value="__custom">Other (type below)</option>
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Points/Miles Balance</label>
                    <input name="pointsBalance" type="number" defaultValue={editingAccount?.pointsBalance || 0}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status Level</label>
                    <input name="statusLevel" defaultValue={editingAccount?.statusLevel || ''} placeholder="e.g. Gold, Platinum"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number (optional)</label>
                  <input name="accountNumber" defaultValue={editingAccount?.accountNumber || ''}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors disabled:opacity-50">
                    {saving ? 'Saving...' : editingAccount ? 'Update' : 'Add Account'}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setEditingAccount(null); }}
                    className="px-6 py-2.5 bg-gray-100 text-gray-600 font-medium rounded-xl hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Accounts list */}
        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="h-5 w-40 bg-gray-200 rounded mb-3" />
                <div className="h-4 w-24 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No loyalty accounts yet</h3>
            <p className="text-gray-500 mb-4">Add your first program to start tracking points and miles.</p>
            <button onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors">
              Add First Account
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((acct) => (
              <div key={acct.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Program icon/badge */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      acct.programCategory === 'airline' ? 'bg-blue-50' :
                      acct.programCategory === 'car' ? 'bg-accent-50' :
                      acct.programCategory === 'credit_card' ? 'bg-purple-50' : 'bg-brand-50'
                    }`}>
                      <svg className={`w-5 h-5 ${
                        acct.programCategory === 'airline' ? 'text-blue-500' :
                        acct.programCategory === 'car' ? 'text-accent-500' :
                        acct.programCategory === 'credit_card' ? 'text-purple-500' : 'text-brand-500'
                      }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        {acct.programCategory === 'airline' ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                        ) : acct.programCategory === 'car' ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                        ) : acct.programCategory === 'credit_card' ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
                        )}
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 truncate">{acct.programName}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColors[acct.programCategory] || categoryColors.other}`}>
                          {acct.programCategory}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                        {acct.statusLevel && <span>{acct.statusLevel}</span>}
                        {acct.bestRedemptionType && <span>Best: {acct.bestRedemptionType}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Points + value */}
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-gray-900">{acct.pointsBalance.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">pts/miles</div>
                    {acct.estimatedValueUsd != null && acct.estimatedValueUsd > 0 && (
                      <div className="text-sm font-semibold text-brand-600 mt-0.5">
                        ~{fmt.format(acct.estimatedValueUsd)}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => { setEditingAccount(acct); setSelectedCategory(acct.programCategory); setShowForm(true); }}
                      className="p-2 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(acct.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Market valuations */}
        {valuations.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Market Point Values</h2>
            <p className="text-sm text-gray-500 mb-4">Current estimated values per point/mile (source: The Points Guy 2026).</p>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Program</th>
                    <th className="text-right px-5 py-3 font-semibold text-gray-600">Value/Point</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden sm:table-cell">Best Redemption</th>
                  </tr>
                </thead>
                <tbody>
                  {valuations.map((v) => (
                    <tr key={v.programName} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-medium text-gray-900">{v.programName}</td>
                      <td className="px-5 py-3 text-right font-semibold text-brand-600">
                        {Number(v.pointValueCents).toFixed(1)}&cent;
                      </td>
                      <td className="px-5 py-3 text-gray-500 hidden sm:table-cell">
                        {v.bestRedemptionType || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
