'use client';

import { useState } from 'react';

interface CardRecommendation {
  cardProgram: string;
  transferTo: string;
  pointsEarned: number;
  estimatedValue: number;
  strategy: string;
}

const providers: Record<string, string[]> = {
  hotel: ['Marriott', 'Hilton', 'Hyatt', 'IHG', 'Wyndham', 'Best Western', 'Choice Hotels', 'Other'],
  flight: ['Delta', 'United', 'American', 'Southwest', 'JetBlue', 'Alaska', 'Spirit', 'Frontier', 'Other'],
  car: ['Hertz', 'Enterprise', 'National', 'Avis', 'Budget', 'Sixt', 'Other'],
};

const presets = [
  { label: '$100/night hotel', type: 'hotel', provider: 'Marriott', amount: 500, nights: 5 },
  { label: '$350 round-trip flight', type: 'flight', provider: 'Delta', amount: 350 },
  { label: '$200 car rental', type: 'car', provider: 'Enterprise', amount: 200 },
];

export default function CardOptimizerPage() {
  const [bookingType, setBookingType] = useState('hotel');
  const [provider, setProvider] = useState('');
  const [amount, setAmount] = useState('');
  const [recommendations, setRecommendations] = useState<CardRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider || !amount) return;
    await fetchRecommendations(bookingType, provider, parseFloat(amount));
  };

  const fetchRecommendations = async (type: string, prov: string, amt: number) => {
    setLoading(true);
    setSearched(false);
    try {
      const res = await fetch(`${apiUrl}/api/loyalty/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingType: type, provider: prov, amountUsd: amt }),
      });
      const data = await res.json();
      if (data.success) setRecommendations(data.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const best = recommendations[0];

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Card Optimizer</h1>
        <p className="text-gray-500 mt-1">
          Find which credit card earns the most value for any travel booking.
        </p>
      </div>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="text-sm text-gray-500 self-center mr-1">Quick:</span>
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              setBookingType(p.type);
              setProvider(p.provider);
              setAmount(String(p.amount));
              fetchRecommendations(p.type, p.provider, p.amount);
            }}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Search form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-shrink-0">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Type</label>
            <select
              value={bookingType}
              onChange={(e) => { setBookingType(e.target.value); setProvider(''); }}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white w-full sm:w-auto"
            >
              <option value="hotel">Hotel</option>
              <option value="flight">Flight</option>
              <option value="car">Car Rental</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"
            >
              <option value="">Select provider...</option>
              {(providers[bookingType] || []).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-40">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Amount ($)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
              required
              min="1"
              step="0.01"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Optimize'}
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      {searched && recommendations.length > 0 && (
        <div className="space-y-6">
          {/* Best card highlight */}
          {best && (
            <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full font-medium">Best Card</span>
              </div>
              <div className="text-2xl font-bold mb-1">{best.cardProgram}</div>
              <div className="text-purple-200 text-sm mb-3">
                Transfer to {best.transferTo} for maximum value
              </div>
              <div className="flex items-baseline gap-4">
                <div>
                  <div className="text-3xl font-extrabold">${best.estimatedValue.toFixed(2)}</div>
                  <div className="text-purple-200 text-xs">estimated value</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{best.pointsEarned.toLocaleString()}</div>
                  <div className="text-purple-200 text-xs">points earned</div>
                </div>
              </div>
              <p className="text-sm text-purple-100 mt-3 leading-relaxed">{best.strategy}</p>
            </div>
          )}

          {/* All recommendations */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">All Recommendations</h2>
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <div
                  key={rec.cardProgram}
                  className={`flex items-center gap-4 p-4 rounded-xl ${
                    i === 0 ? 'bg-purple-50 border border-purple-200' : 'bg-white border border-gray-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                    i === 0 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{rec.cardProgram}</span>
                      {i === 0 && <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">Best</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{rec.strategy}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-purple-700">${rec.estimatedValue.toFixed(2)}</div>
                    <div className="text-xs text-gray-400">{rec.pointsEarned.toLocaleString()} pts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Explainer */}
          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            <h3 className="text-sm font-bold text-gray-700 mb-2">How it works</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              We evaluate Chase Ultimate Rewards, Amex Membership Rewards, Citi ThankYou, and Capital One Miles.
              For each, we calculate the direct earning rate and check if transferring to the provider&apos;s loyalty
              program yields higher value. The recommendation with the highest estimated dollar value wins.
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {searched && recommendations.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">💳</div>
          <p className="text-gray-500">No recommendations found. Try a different provider or amount.</p>
        </div>
      )}

      {!searched && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">💳</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Maximize your points</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Enter a booking above or use a quick preset to see which credit card earns the most value.
          </p>
        </div>
      )}
    </>
  );
}
