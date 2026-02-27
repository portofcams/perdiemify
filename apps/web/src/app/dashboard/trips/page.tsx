'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

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
  createdAt: string;
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function daysBetween(start: string, end: string) {
  const d1 = new Date(start);
  const d2 = new Date(end);
  return Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / 86400000));
}

function statusColor(status: string) {
  switch (status) {
    case 'active': return 'bg-brand-50 text-brand-700 border-brand-200';
    case 'completed': return 'bg-gray-100 text-gray-600 border-gray-200';
    case 'cancelled': return 'bg-red-50 text-red-600 border-red-200';
    default: return 'bg-gray-50 text-gray-500 border-gray-200';
  }
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

export default function TripsPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchTrips = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/trips`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setTrips(data.data);
    } catch {
      setError('Failed to load trips');
    } finally {
      setLoading(false);
    }
  }, [getToken, apiUrl]);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get('name'),
      destination: form.get('destination'),
      destinationState: form.get('destinationState') || null,
      origin: form.get('origin') || null,
      startDate: form.get('startDate'),
      endDate: form.get('endDate'),
      lodgingRate: Number(form.get('lodgingRate')),
      mieRate: Number(form.get('mieRate')),
      notes: form.get('notes') || null,
    };

    try {
      const token = await getToken();
      const url = editingTrip
        ? `${apiUrl}/api/trips/${editingTrip.id}`
        : `${apiUrl}/api/trips`;
      const res = await fetch(url, {
        method: editingTrip ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        setEditingTrip(null);
        fetchTrips();
      } else {
        setError(data.error || 'Failed to save trip');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this trip? This cannot be undone.')) return;
    try {
      const token = await getToken();
      await fetch(`${apiUrl}/api/trips/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchTrips();
    } catch {
      setError('Failed to delete trip');
    }
  };

  const totalSavings = trips.reduce((sum, t) => sum + Number(t.totalSavings || 0), 0);
  const activeTrips = trips.filter(t => t.status === 'active');

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
            <Link href="/dashboard/trips" className="text-sm font-medium text-brand-600">
              Trips
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Trips</h1>
            <p className="text-gray-500 mt-1">
              {trips.length} trip{trips.length !== 1 ? 's' : ''} &middot; {fmt.format(totalSavings)} total savings
            </p>
          </div>
          <button
            onClick={() => { setEditingTrip(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/25"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Trip
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="text-sm text-gray-500">Active Trips</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{activeTrips.length}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="text-sm text-gray-500">Total Savings</div>
            <div className="text-2xl font-bold text-brand-600 mt-1">{fmt.format(totalSavings)}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="text-sm text-gray-500">All Trips</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{trips.length}</div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Trip Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingTrip ? 'Edit Trip' : 'New Trip'}
                </h2>
                <button onClick={() => { setShowForm(false); setEditingTrip(null); }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trip Name</label>
                  <input name="name" required defaultValue={editingTrip?.name || ''} placeholder="e.g. DC Conference March 2026"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
                    <input name="destination" required defaultValue={editingTrip?.destination || ''} placeholder="Washington, DC"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <select name="destinationState" defaultValue={editingTrip?.destinationState || ''}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm">
                      <option value="">Select...</option>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origin (optional)</label>
                  <input name="origin" defaultValue={editingTrip?.origin || ''} placeholder="e.g. San Antonio, TX"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input name="startDate" type="date" required defaultValue={editingTrip?.startDate || ''}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input name="endDate" type="date" required defaultValue={editingTrip?.endDate || ''}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lodging Rate ($/night)</label>
                    <input name="lodgingRate" type="number" step="0.01" required defaultValue={editingTrip?.lodgingRate || ''}
                      placeholder="182"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">M&IE Rate ($/day)</label>
                    <input name="mieRate" type="number" step="0.01" required defaultValue={editingTrip?.mieRate || ''}
                      placeholder="79"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <textarea name="notes" rows={2} defaultValue={editingTrip?.notes || ''}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm resize-none" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors disabled:opacity-50">
                    {saving ? 'Saving...' : editingTrip ? 'Update Trip' : 'Create Trip'}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setEditingTrip(null); }}
                    className="px-6 py-2.5 bg-gray-100 text-gray-600 font-medium rounded-xl hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Trip list */}
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
            <p className="text-gray-500 mb-4">Create your first trip to start tracking per diem savings.</p>
            <button onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors">
              Create First Trip
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {trips.map((trip) => {
              const nights = daysBetween(trip.startDate, trip.endDate);
              const totalAllowance = nights * Number(trip.lodgingRate) + (nights + 1) * Number(trip.mieRate);
              const savings = Number(trip.totalSavings || 0);

              return (
                <div key={trip.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                      </svg>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 truncate">{trip.name}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColor(trip.status)}`}>
                          {trip.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span>{trip.destination}{trip.destinationState ? `, ${trip.destinationState}` : ''}</span>
                        <span>{new Date(trip.startDate + 'T00:00:00').toLocaleDateString()} — {new Date(trip.endDate + 'T00:00:00').toLocaleDateString()}</span>
                        <span>{nights} night{nights !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {/* Rates + actions */}
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Allowance</div>
                        <div className="font-bold text-gray-900">{fmt.format(totalAllowance)}</div>
                        {savings > 0 && (
                          <div className="text-sm font-semibold text-brand-600">+{fmt.format(savings)} saved</div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingTrip(trip); setShowForm(true); }}
                          className="p-2 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(trip.id)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
