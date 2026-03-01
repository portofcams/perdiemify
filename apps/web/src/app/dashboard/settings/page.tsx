'use client';

import { useUser, useAuth } from '@clerk/nextjs';
import { useState, useEffect } from 'react';

interface UserProfile {
  name: string | null;
  perDiemSource: string;
  customLodgingRate: string | null;
  customMieRate: string | null;
}

interface Integration {
  id: string;
  provider: string;
  is_active: boolean;
  created_at: string;
}

export default function SettingsPage() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [profile, setProfile] = useState<UserProfile>({
    name: null,
    perDiemSource: 'gsa',
    customLodgingRate: null,
    customMieRate: null,
  });
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Notification prefs (localStorage for now)
  const [notifications, setNotifications] = useState({
    priceAlerts: true,
    weeklyDigest: false,
    dealNotifications: true,
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    async function fetchData() {
      try {
        const token = await getToken();
        const headers = { Authorization: `Bearer ${token}` };

        const [profileRes, integrationsRes] = await Promise.all([
          fetch(`${apiUrl}/api/users/me`, { headers }),
          fetch(`${apiUrl}/api/integrations`, { headers }).catch(() => null),
        ]);

        const profileData = await profileRes.json();
        if (profileData.success && profileData.data) {
          setProfile({
            name: profileData.data.name,
            perDiemSource: profileData.data.perDiemSource || 'gsa',
            customLodgingRate: profileData.data.customLodgingRate || null,
            customMieRate: profileData.data.customMieRate || null,
          });
        }

        if (integrationsRes) {
          const intData = await integrationsRes.json();
          if (intData.success) setIntegrations(intData.data || []);
        }

        // Load notification prefs from localStorage
        const stored = localStorage.getItem('perdiemify_notifications');
        if (stored) setNotifications(JSON.parse(stored));
      } catch {
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [getToken, apiUrl]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          perDiemSource: profile.perDiemSource,
          customLodgingRate: profile.perDiemSource === 'custom' ? Number(profile.customLodgingRate) : null,
          customMieRate: profile.perDiemSource === 'custom' ? Number(profile.customMieRate) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationChange = (key: keyof typeof notifications) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    localStorage.setItem('perdiemify_notifications', JSON.stringify(updated));
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm('Disconnect this integration?')) return;
    try {
      const token = await getToken();
      await fetch(`${apiUrl}/api/integrations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setIntegrations(prev => prev.filter(i => i.id !== id));
    } catch {
      setError('Failed to disconnect');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account preferences and integrations.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {saved && (
        <div className="mb-6 p-4 bg-brand-50 border border-brand-200 rounded-xl text-brand-700 text-sm font-medium">
          Settings saved successfully.
        </div>
      )}

      <div className="space-y-8">
        {/* Profile Info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Profile</h2>
          <div className="flex items-center gap-4 mb-6">
            {user?.imageUrl && (
              <img
                src={user.imageUrl}
                alt=""
                className="w-14 h-14 rounded-xl object-cover"
              />
            )}
            <div>
              <p className="font-semibold text-gray-900">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm text-gray-500">
                {user?.emailAddresses?.[0]?.emailAddress}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Profile details are managed through your Clerk account.{' '}
            <button
              onClick={() => (user as any)?.openUserProfile?.()}
              className="text-brand-600 font-medium hover:underline"
            >
              Manage Account
            </button>
          </p>
        </div>

        {/* Per Diem Preferences */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Per Diem Preferences</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Per Diem Source</label>
              <select
                value={profile.perDiemSource}
                onChange={(e) => setProfile(p => ({ ...p, perDiemSource: e.target.value }))}
                className="w-full sm:w-64 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm"
              >
                <option value="gsa">GSA (Federal Civilian)</option>
                <option value="jtr">JTR (Military / DoD)</option>
                <option value="corporate">Corporate Rate</option>
                <option value="custom">Custom Rates</option>
              </select>
            </div>

            {profile.perDiemSource === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lodging Rate ($/night)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={profile.customLodgingRate || ''}
                    onChange={(e) => setProfile(p => ({ ...p, customLodgingRate: e.target.value }))}
                    placeholder="182"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    M&IE Rate ($/day)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={profile.customMieRate || ''}
                    onChange={(e) => setProfile(p => ({ ...p, customMieRate: e.target.value }))}
                    placeholder="79"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-6 py-2.5 bg-brand-500 text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/25 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Notifications</h2>
          <div className="space-y-4">
            {[
              { key: 'priceAlerts' as const, label: 'Price Drop Alerts', desc: 'Get notified when hotel prices drop below your target.' },
              { key: 'weeklyDigest' as const, label: 'Weekly Savings Digest', desc: 'A weekly summary of your per diem savings and tips.' },
              { key: 'dealNotifications' as const, label: 'New Deal Notifications', desc: 'Be the first to know about new discount codes.' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                <button
                  onClick={() => handleNotificationChange(key)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    notifications[key] ? 'bg-brand-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      notifications[key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Connected Integrations */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Connected Integrations</h2>
          {integrations.length === 0 ? (
            <p className="text-sm text-gray-500">No integrations connected yet.</p>
          ) : (
            <div className="space-y-3">
              {integrations.map(integration => (
                <div key={integration.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-600">
                        {integration.provider === 'concur' ? 'C' : 'E'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {integration.provider === 'concur' ? 'SAP Concur' : 'Expensify'}
                      </p>
                      <p className="text-xs text-gray-400">
                        Connected {new Date(integration.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      integration.is_active ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {integration.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => handleDisconnect(integration.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">
              Connect Concur
            </button>
            <button className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">
              Connect Expensify
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
