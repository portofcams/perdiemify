'use client';

import { useAuth } from '@clerk/nextjs';
import { useState, useEffect, useCallback } from 'react';

interface Booking {
  id: string;
  type: string;
  provider: string;
  providerName: string | null;
  price: string;
  perDiemDelta: string | null;
  bookingRef: string | null;
  loyaltyProgram: string | null;
  loyaltyPointsEarned: number;
  discountCodeUsed: string | null;
  checkIn: string | null;
  checkOut: string | null;
  createdAt: string;
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const typeIcons: Record<string, string> = { hotel: '🏨', flight: '✈️', car: '🚗' };

export default function BookingsPage() {
  const { getToken } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const fetchBookings = useCallback(async () => {
    try {
      const token = await getToken();
      const params = filterType !== 'all' ? `?type=${filterType}` : '';
      const res = await fetch(`${apiUrl}/api/bookings${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setBookings(data.data);
    } catch {
      setError('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [getToken, apiUrl, filterType]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      type: form.get('type'),
      provider: form.get('provider'),
      providerName: form.get('providerName') || null,
      price: Number(form.get('price')),
      perDiemDelta: form.get('perDiemDelta') ? Number(form.get('perDiemDelta')) : null,
      bookingRef: form.get('bookingRef') || null,
      loyaltyProgram: form.get('loyaltyProgram') || null,
      loyaltyPointsEarned: Number(form.get('loyaltyPointsEarned') || 0),
      discountCodeUsed: form.get('discountCodeUsed') || null,
      checkIn: form.get('checkIn') || null,
      checkOut: form.get('checkOut') || null,
    };

    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        fetchBookings();
      } else {
        setError(data.error || 'Failed to save booking');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this booking?')) return;
    try {
      const token = await getToken();
      await fetch(`${apiUrl}/api/bookings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchBookings();
    } catch {
      setError('Failed to delete booking');
    }
  };

  const totalSpent = bookings.reduce((sum, b) => sum + Number(b.price), 0);
  const totalSaved = bookings.reduce((sum, b) => sum + Math.max(0, Number(b.perDiemDelta || 0)), 0);

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-500 mt-1">Track your travel bookings and per diem savings.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/25"
        >
          + Add Booking
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="text-sm text-gray-500">Total Bookings</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{bookings.length}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="text-sm text-gray-500">Total Spent</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{fmt.format(totalSpent)}</div>
        </div>
        <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl p-5 text-white">
          <div className="text-sm text-brand-100">Per Diem Savings</div>
          <div className="text-2xl font-bold mt-1">{fmt.format(totalSaved)}</div>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex gap-2 mb-6">
        {['all', 'hotel', 'flight', 'car'].map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filterType === t
                ? 'bg-brand-50 text-brand-700 border border-brand-200'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t === 'all' ? 'All' : `${typeIcons[t] || ''} ${t.charAt(0).toUpperCase() + t.slice(1)}s`}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {/* Add Booking Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Add Booking</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select name="type" required className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white">
                    <option value="hotel">Hotel</option>
                    <option value="flight">Flight</option>
                    <option value="car">Car Rental</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                  <input name="provider" required placeholder="e.g. Marriott" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property/Flight Name</label>
                <input name="providerName" placeholder="e.g. Marriott Crystal City" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Price ($)</label>
                  <input name="price" type="number" step="0.01" required className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Per Diem Savings ($)</label>
                  <input name="perDiemDelta" type="number" step="0.01" placeholder="0.00" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
                  <input name="checkIn" type="date" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
                  <input name="checkOut" type="date" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Booking Ref</label>
                  <input name="bookingRef" placeholder="Confirmation #" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Code</label>
                  <input name="discountCodeUsed" placeholder="Optional" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loyalty Program</label>
                  <input name="loyaltyProgram" placeholder="e.g. Marriott Bonvoy" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points Earned</label>
                  <input name="loyaltyPointsEarned" type="number" defaultValue={0} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : 'Add Booking'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-6 py-2.5 bg-gray-100 text-gray-600 font-medium rounded-xl hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bookings list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
              <div className="h-5 w-40 bg-gray-200 rounded mb-3" />
              <div className="h-4 w-24 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No bookings yet</h3>
          <p className="text-gray-500 mb-4">Add your first booking to start tracking travel spending and savings.</p>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors">
            Add First Booking
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const delta = Number(booking.perDiemDelta || 0);
            return (
              <div key={booking.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl shrink-0">
                    {typeIcons[booking.type] || '📦'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 truncate">
                        {booking.providerName || booking.provider}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {booking.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5 flex-wrap">
                      {booking.checkIn && (
                        <span>{booking.checkIn}{booking.checkOut ? ` → ${booking.checkOut}` : ''}</span>
                      )}
                      {booking.bookingRef && <span>Ref: {booking.bookingRef}</span>}
                      {booking.loyaltyProgram && (
                        <span className="text-brand-600">{booking.loyaltyProgram} — {booking.loyaltyPointsEarned.toLocaleString()} pts</span>
                      )}
                    </div>
                  </div>

                  {/* Price + savings */}
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-gray-900">{fmt.format(Number(booking.price))}</div>
                    {delta !== 0 && (
                      <div className={`text-sm font-semibold ${delta > 0 ? 'text-brand-600' : 'text-red-500'}`}>
                        {delta > 0 ? '+' : ''}{fmt.format(delta)} saved
                      </div>
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(booking.id)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
