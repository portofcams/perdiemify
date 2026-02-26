// Per diem badge thresholds (percentage of allowance used)
export const PERDIEM_BADGE_THRESHOLDS = {
  under: 0.85, // Green: using less than 85% of allowance
  near: 1.0,   // Yellow: 85-100% of allowance
  // over: above 100%  — Red
} as const;

// First/last day M&IE rate multiplier (75% per GSA rules)
export const FIRST_LAST_DAY_RATE = 0.75;

// Default search limits
export const SEARCH_LIMITS = {
  free: 5,       // searches per day
  pro: Infinity,
  proplus: Infinity,
} as const;

// Cache TTLs (seconds)
export const CACHE_TTL = {
  searchResults: 900,      // 15 minutes
  perDiemRates: 86400,     // 24 hours
  discountCodes: 3600,     // 1 hour
  loyaltyValuations: 604800, // 7 days
} as const;

// Subscription pricing
export const PRICING = {
  pro: {
    monthly: 9.99,
    yearly: 99,
    name: 'Pro',
  },
  proplus: {
    monthly: 19.99,
    yearly: 199,
    name: 'Pro+',
  },
} as const;

// Supported loyalty programs
export const LOYALTY_PROGRAMS = {
  airline: [
    'Delta SkyMiles',
    'United MileagePlus',
    'American AAdvantage',
    'Southwest Rapid Rewards',
    'JetBlue TrueBlue',
    'Alaska Mileage Plan',
  ],
  hotel: [
    'Marriott Bonvoy',
    'Hilton Honors',
    'IHG One Rewards',
    'World of Hyatt',
    'Wyndham Rewards',
    'Choice Privileges',
    'Best Western Rewards',
  ],
  car: [
    'National Emerald Club',
    'Hertz Gold Plus',
    'Avis Preferred',
    'Enterprise Plus',
  ],
  credit_card: [
    'Chase Ultimate Rewards',
    'Amex Membership Rewards',
    'Citi ThankYou',
    'Capital One Miles',
  ],
} as const;

// Brand colors
export const COLORS = {
  brand: {
    50: '#f0fdf4',
    100: '#dcfce7',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    900: '#064e3b',
  },
  accent: {
    50: '#fffbeb',
    500: '#f59e0b',
    600: '#d97706',
  },
  perdiem: {
    under: '#10b981',
    near: '#f59e0b',
    over: '#ef4444',
  },
} as const;

// GSA API base URL
export const GSA_API_BASE = 'https://api.gsa.gov/travel/perdiem/v2';

// Current fiscal year (GSA fiscal year starts October 1)
export function getCurrentFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  return month >= 9 ? year + 1 : year;
}
