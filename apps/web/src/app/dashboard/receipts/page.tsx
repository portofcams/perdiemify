'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';

interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  lodgingRate: string;
  mieRate: string;
}

interface Receipt {
  id: string;
  tripId: string | null;
  imageUrl: string;
  storageKey: string | null;
  status: string;
  ocrVendor: string | null;
  ocrAmount: string | null;
  ocrDate: string | null;
  ocrCategory: string | null;
  isVerified: boolean;
  createdAt: string;
}

interface ComplianceDay {
  date: string;
  lodgingSpent: number;
  lodgingAllowance: number;
  mieSpent: number;
  mieAllowance: number;
  totalSpent: number;
  totalAllowance: number;
  delta: number;
}

interface ComplianceTotals {
  totalAllowance: number;
  totalSpent: number;
  delta: number;
  receiptCount: number;
  verifiedCount: number;
}

interface ComplianceData {
  trip: {
    id: string;
    name: string;
    destination: string;
    startDate: string;
    endDate: string;
    lodgingRate: number;
    mieRate: number;
  };
  days: ComplianceDay[];
  totals: ComplianceTotals;
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const statusBadge: Record<string, { label: string; className: string }> = {
  processing: { label: 'Processing', className: 'bg-amber-50 text-amber-700' },
  ready: { label: 'Ready', className: 'bg-blue-50 text-blue-700' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700' },
};

const categoryColors: Record<string, string> = {
  lodging: 'bg-purple-50 text-purple-700',
  meals: 'bg-amber-50 text-amber-700',
  transport: 'bg-blue-50 text-blue-700',
  parking: 'bg-teal-50 text-teal-700',
  tips: 'bg-pink-50 text-pink-700',
  other: 'bg-gray-100 text-gray-600',
};

export default function ReceiptsPage() {
  const { getToken } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<string>('');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{
    ocrVendor: string; ocrAmount: string; ocrDate: string; ocrCategory: string;
  }>({ ocrVendor: '', ocrAmount: '', ocrDate: '', ocrCategory: '' });
  const [saving, setSaving] = useState(false);
  const [exportFormat, setExportFormat] = useState<string>('generic');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Fetch trips
  useEffect(() => {
    async function fetchTrips() {
      try {
        const token = await getToken();
        const res = await fetch(`${apiUrl}/api/trips`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          setTrips(data.data);
          setSelectedTrip(data.data[0].id);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchTrips();
  }, [getToken, apiUrl]);

  // Fetch receipts + compliance when trip changes
  const fetchData = useCallback(async () => {
    if (!selectedTrip) return;
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [receiptsRes, complianceRes] = await Promise.all([
        fetch(`${apiUrl}/api/receipts?tripId=${selectedTrip}`, { headers }),
        fetch(`${apiUrl}/api/receipts/compliance?tripId=${selectedTrip}`, { headers }),
      ]);
      const [receiptsData, complianceData] = await Promise.all([receiptsRes.json(), complianceRes.json()]);
      if (receiptsData.success) setReceipts(receiptsData.data);
      if (complianceData.success) setCompliance(complianceData.data);
    } catch {
      setError('Failed to load receipt data');
    }
  }, [selectedTrip, getToken, apiUrl]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Poll for processing receipts
  useEffect(() => {
    const hasProcessing = receipts.some(r => r.status === 'processing');
    if (hasProcessing) {
      pollingRef.current = setInterval(() => { fetchData(); }, 3000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [receipts, fetchData]);

  // Upload handler
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTrip) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('receipt', file);
    formData.append('tripId', selectedTrip);

    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/receipts/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch {
      setError('Network error during upload');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Edit OCR data
  const startEdit = (receipt: Receipt) => {
    setEditingId(receipt.id);
    setEditFields({
      ocrVendor: receipt.ocrVendor || '',
      ocrAmount: receipt.ocrAmount || '',
      ocrDate: receipt.ocrDate || '',
      ocrCategory: receipt.ocrCategory || 'other',
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/receipts/${editingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ocrVendor: editFields.ocrVendor || null,
          ocrAmount: editFields.ocrAmount ? Number(editFields.ocrAmount) : null,
          ocrDate: editFields.ocrDate || null,
          ocrCategory: editFields.ocrCategory || null,
          isVerified: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingId(null);
        fetchData();
      } else {
        setError(data.error || 'Save failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  // Delete receipt
  const handleDelete = async (id: string) => {
    try {
      const token = await getToken();
      await fetch(`${apiUrl}/api/receipts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchData();
    } catch {
      setError('Failed to delete');
    }
  };

  // Export handlers
  const handleExportCsv = async () => {
    if (!selectedTrip) return;
    try {
      const token = await getToken();
      const res = await fetch(
        `${apiUrl}/api/receipts/export/csv?tripId=${selectedTrip}&format=${exportFormat}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses_${exportFormat}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed');
    }
  };

  const handleExportPdf = async () => {
    if (!selectedTrip) return;
    try {
      const token = await getToken();
      const res = await fetch(
        `${apiUrl}/api/receipts/export/pdf?tripId=${selectedTrip}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'expense_report.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed');
    }
  };

  const verifiedCount = receipts.filter(r => r.isVerified).length;
  const totalAmount = receipts
    .filter(r => r.status === 'ready' || r.isVerified)
    .reduce((s, r) => s + (Number(r.ocrAmount) || 0), 0);

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
            <Link href="/dashboard/meals" className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors">
              Meals
            </Link>
            <Link href="/dashboard/receipts" className="text-sm font-medium text-brand-600">
              Receipts
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Receipts & Expenses</h1>
            <p className="text-gray-500 mt-1">Scan receipts, track expenses, export reports.</p>
          </div>
          {selectedTrip && (
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/25 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                    </svg>
                    Scan Receipt
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Trip selector */}
        {trips.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Trip</label>
            <select
              value={selectedTrip}
              onChange={(e) => setSelectedTrip(e.target.value)}
              className="w-full sm:w-80 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm"
            >
              {trips.map(t => (
                <option key={t.id} value={t.id}>{t.name} — {t.destination}</option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="h-5 w-48 bg-gray-200 rounded mb-3" />
                <div className="h-4 w-32 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No trips yet</h3>
            <p className="text-gray-500 mb-4">Create a trip first to start scanning receipts.</p>
            <Link href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors">
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="text-sm text-gray-500">Receipts</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{receipts.length}</div>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="text-sm text-gray-500">Total Amount</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{fmt.format(totalAmount)}</div>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="text-sm text-gray-500">Verified</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{verifiedCount}/{receipts.length}</div>
              </div>
              {compliance && (
                <div className={`rounded-2xl p-5 border shadow-sm ${
                  compliance.totals.delta >= 0
                    ? 'bg-brand-50 border-brand-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className={`text-sm ${compliance.totals.delta >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
                    {compliance.totals.delta >= 0 ? 'Under Budget' : 'Over Budget'}
                  </div>
                  <div className={`text-2xl font-bold mt-1 ${compliance.totals.delta >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
                    {fmt.format(Math.abs(compliance.totals.delta))}
                  </div>
                </div>
              )}
            </div>

            {/* Compliance Summary */}
            {compliance && compliance.days.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-8 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">Per Diem Compliance</h3>
                  <div className="text-sm text-gray-500">
                    Lodging: {fmt.format(compliance.trip.lodgingRate)}/night &middot; M&IE: {fmt.format(compliance.trip.mieRate)}/day
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Date</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Lodging</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600">L. Rate</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600">M&IE</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600">M&IE Rate</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Total</th>
                        <th className="text-right px-5 py-2.5 font-semibold text-gray-600">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compliance.days.map(day => (
                        <tr key={day.date} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-5 py-2.5 font-medium text-gray-900">
                            {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-900">{fmt.format(day.lodgingSpent)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-400">{fmt.format(day.lodgingAllowance)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-900">{fmt.format(day.mieSpent)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-400">{fmt.format(day.mieAllowance)}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-gray-900">{fmt.format(day.totalSpent)}</td>
                          <td className={`px-5 py-2.5 text-right font-semibold ${day.delta >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
                            {day.delta >= 0 ? '+' : ''}{fmt.format(day.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Export Section */}
            {receipts.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-8 p-5">
                <h3 className="font-bold text-gray-900 mb-4">Export Expense Report</h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">CSV Format:</label>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                    >
                      <option value="generic">Generic</option>
                      <option value="concur">SAP Concur</option>
                      <option value="expensify">Expensify</option>
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleExportCsv}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Download CSV
                    </button>
                    <button
                      onClick={handleExportPdf}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white font-medium rounded-lg hover:bg-brand-600 transition-colors text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                      Download PDF
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Receipt List */}
            <h3 className="font-bold text-gray-900 mb-4">
              Receipt Log {receipts.length > 0 && <span className="font-normal text-gray-400">({receipts.length})</span>}
            </h3>
            {receipts.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                </svg>
                <p className="text-gray-500 mb-3">No receipts for this trip yet.</p>
                <button onClick={() => fileInputRef.current?.click()}
                  className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                  Upload your first receipt
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {receipts.map(receipt => (
                  <div key={receipt.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4 flex items-center gap-4">
                      {/* Status badge */}
                      {receipt.isVerified ? (
                        <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-brand-50 text-brand-700">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                          Verified
                        </span>
                      ) : receipt.status === 'processing' ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                          </svg>
                          Processing
                        </span>
                      ) : (
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge[receipt.status]?.className || 'bg-gray-100 text-gray-600'}`}>
                          {statusBadge[receipt.status]?.label || receipt.status}
                        </span>
                      )}

                      {/* Category */}
                      {receipt.ocrCategory && (
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${categoryColors[receipt.ocrCategory] || categoryColors.other}`}>
                          {receipt.ocrCategory}
                        </span>
                      )}

                      {/* Vendor + date */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {receipt.ocrVendor || 'Pending OCR...'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {receipt.ocrDate
                            ? new Date(receipt.ocrDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                            : new Date(receipt.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="font-bold text-gray-900 text-sm">
                        {receipt.ocrAmount ? fmt.format(Number(receipt.ocrAmount)) : '—'}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {receipt.status !== 'processing' && (
                          <button
                            onClick={() => startEdit(receipt)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            title="Edit & verify"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(receipt.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Edit panel (inline expand) */}
                    {editingId === receipt.id && (
                      <div className="border-t border-gray-100 bg-gray-50 p-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Vendor</label>
                            <input
                              value={editFields.ocrVendor}
                              onChange={(e) => setEditFields(f => ({ ...f, ocrVendor: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Amount ($)</label>
                            <input
                              value={editFields.ocrAmount}
                              onChange={(e) => setEditFields(f => ({ ...f, ocrAmount: e.target.value }))}
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                            <input
                              value={editFields.ocrDate}
                              onChange={(e) => setEditFields(f => ({ ...f, ocrDate: e.target.value }))}
                              type="date"
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                            <select
                              value={editFields.ocrCategory}
                              onChange={(e) => setEditFields(f => ({ ...f, ocrCategory: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                            >
                              <option value="lodging">Lodging</option>
                              <option value="meals">Meals</option>
                              <option value="transport">Transport</option>
                              <option value="parking">Parking</option>
                              <option value="tips">Tips</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="px-4 py-2 bg-brand-500 text-white font-medium rounded-lg hover:bg-brand-600 transition-colors text-sm disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save & Verify'}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-4 py-2 bg-gray-100 text-gray-600 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
