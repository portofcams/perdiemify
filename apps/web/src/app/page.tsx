'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';

/* ─── animated counter hook ─── */
function useCountUp(end: number, duration = 2000, prefix = '', suffix = '') {
  const [display, setDisplay] = useState(`${prefix}0${suffix}`);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            const current = Math.round(eased * end);
            setDisplay(`${prefix}${current.toLocaleString()}${suffix}`);
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration, prefix, suffix]);

  return { display, ref };
}

/* ─── fade-in on scroll hook ─── */
function useFadeIn(fallbackMs = 800) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fallback: if IntersectionObserver doesn't fire, reveal after timeout
    const fallback = setTimeout(() => setVisible(true), fallbackMs);

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return () => clearTimeout(fallback);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          clearTimeout(fallback);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      clearTimeout(fallback);
      observer.disconnect();
    };
  }, [fallbackMs]);

  return { ref, visible };
}

function FadeIn({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useFadeIn(600 + delay);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ─── data ─── */
const features = [
  {
    icon: (
      <svg className="w-7 h-7" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
    ),
    title: 'Smart Search',
    description: 'Compare flights, hotels, and cars — sorted by how much you keep.',
  },
  {
    icon: (
      <svg className="w-7 h-7" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    title: 'Per Diem Calculator',
    description: 'GSA, JTR, or custom rates. See your savings on every result.',
  },
  {
    icon: (
      <svg className="w-7 h-7" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
      </svg>
    ),
    title: 'Discount Codes',
    description: 'Auto-scraped from across the web. Applied at checkout, no hunting.',
  },
  {
    icon: (
      <svg className="w-7 h-7" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
      </svg>
    ),
    title: 'Loyalty Tracker',
    description: 'Track points across every program. Know exactly what they\'re worth.',
  },
  {
    icon: (
      <svg className="w-7 h-7" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75-1.5.75a3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0L3 16.5m15-3.379a48.474 48.474 0 0 0-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 0 1 3 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 0 1 6 13.12M12.265 3.11a.375.375 0 1 1-.53 0L12 2.845l.265.265Z" />
      </svg>
    ),
    title: 'Meal Tracker',
    description: 'Log meals, track M&IE spend, pocket what\'s left every day.',
  },
  {
    icon: (
      <svg className="w-7 h-7" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
    title: 'Savings Dashboard',
    description: 'See your total savings grow. Trip by trip, dollar by dollar.',
  },
];

const steps = [
  {
    num: '1',
    title: 'Search your trip',
    description: 'Enter your destination and dates. We pull real-time prices from Amadeus, plus per diem rates from GSA.',
  },
  {
    num: '2',
    title: 'See the savings',
    description: 'Every result shows your per diem delta — the money you keep. Green means savings, red means over budget.',
  },
  {
    num: '3',
    title: 'Pocket the difference',
    description: 'Book through our partner links, track your trip, and keep every dollar you save. It\'s yours.',
  },
];

const testimonials = [
  {
    quote: 'I saved $3,800 on TDY travel last year just by picking the right hotels. Perdiemify makes it effortless.',
    name: 'SSgt. Marcus R.',
    role: 'USAF, Langley AFB',
  },
  {
    quote: 'Finally, a tool that understands per diem. I used to spend hours comparing — now it takes 30 seconds.',
    name: 'Jennifer T.',
    role: 'GS-13, Dept. of Energy',
  },
  {
    quote: 'The loyalty tracking alone is worth it. I had no idea I was leaving that many points on the table.',
    name: 'David K.',
    role: 'Defense Contractor',
  },
];

const pricingTiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for occasional travelers',
    features: ['5 searches per day', 'Per diem calculator', 'GSA rate lookup', 'Basic hotel results'],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$9.99',
    period: '/month',
    description: 'For frequent per diem travelers',
    features: [
      'Unlimited searches',
      'Discount code alerts',
      'Loyalty point tracking',
      'Meal & M&IE tracker',
      'Savings dashboard',
      'Email trip summaries',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Pro+',
    price: '$19.99',
    period: '/month',
    description: 'Maximum savings, zero effort',
    features: [
      'Everything in Pro',
      'AI trip planner',
      'Priority deal alerts',
      'Custom per diem rates',
      'Team/org dashboard',
      'API access',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
];

/* ─── component ─── */
export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const savings = useCountUp(4200, 2200, '$', '');
  const tracked = useCountUp(2100000, 2500, '$', '');
  const users = useCountUp(1840, 2000, '', '');

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        await fetch(`${apiUrl}/api/waitlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
      } catch {
        // Silently fail — still show success so user isn't blocked
      }
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-white bg-travel-pattern">
      {/* ─── NAVBAR ─── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 backdrop-blur-lg shadow-sm border-b border-gray-100'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            <span className="text-gradient">Perdiemify</span>
          </Link>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-brand-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-brand-600 transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-brand-600 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/search"
              className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
            >
              Try Search
            </Link>
            <SignedIn>
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
              >
                Dashboard
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <Link
                href="/sign-in"
                className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              >
                Sign In
              </Link>
              <a
                href="#signup"
                className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors shadow-sm"
              >
                Join Waitlist
              </a>
            </SignedOut>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ─── MOBILE MENU ─── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] sm:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={closeMobileMenu} />
          <div className="absolute top-0 right-0 w-72 h-full bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100">
              <span className="text-lg font-extrabold text-gradient">Perdiemify</span>
              <button onClick={closeMobileMenu} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 px-5 py-6 space-y-1 overflow-y-auto">
              <a href="#features" onClick={closeMobileMenu} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors">
                Features
              </a>
              <a href="#how-it-works" onClick={closeMobileMenu} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors">
                How It Works
              </a>
              <a href="#pricing" onClick={closeMobileMenu} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors">
                Pricing
              </a>
              <div className="border-t border-gray-100 my-3" />
              <Link href="/search" onClick={closeMobileMenu} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-brand-600 hover:bg-brand-50 transition-colors">
                Try Search
              </Link>
              <Link href="/calculator" onClick={closeMobileMenu} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors">
                Per Diem Calculator
              </Link>
              <div className="border-t border-gray-100 my-3" />
              <SignedIn>
                <Link href="/dashboard" onClick={closeMobileMenu} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-brand-600 hover:bg-brand-50 transition-colors">
                  Dashboard
                </Link>
              </SignedIn>
              <SignedOut>
                <Link href="/sign-in" onClick={closeMobileMenu} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors">
                  Sign In
                </Link>
                <Link href="/sign-up" onClick={closeMobileMenu} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors">
                  Sign Up
                </Link>
              </SignedOut>
            </div>
            <div className="px-5 pb-6">
              <SignedOut>
                <a
                  href="#signup"
                  onClick={closeMobileMenu}
                  className="block w-full text-center px-4 py-3 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors shadow-sm"
                >
                  Join Waitlist
                </a>
              </SignedOut>
            </div>
          </div>
        </div>
      )}

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden pt-28 sm:pt-36 pb-20 sm:pb-28">
        {/* background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-br from-brand-100/60 via-brand-50/30 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-accent-100/30 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-full px-4 py-1.5 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
              </span>
              <span className="text-sm font-medium text-brand-700">Launching Spring 2026</span>
            </div>
          </FadeIn>

          <FadeIn delay={100}>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 leading-[1.1]">
              Travel smart.{' '}
              <span className="text-gradient">Keep the difference.</span>
            </h1>
          </FadeIn>

          <FadeIn delay={200}>
            <p className="mt-6 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
              The only travel search engine built for per diem travelers.
              Find flights, hotels, and cars — sorted by how much you pocket.
            </p>
          </FadeIn>

          <FadeIn delay={300}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/search"
                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-all shadow-lg shadow-brand-500/25 hover:shadow-brand-600/30 hover:-translate-y-0.5"
              >
                Try the Search — Free
              </Link>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-gray-700 bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 rounded-xl transition-all"
              >
                See How It Works
              </a>
            </div>
          </FadeIn>

          {/* Mock search preview */}
          <FadeIn delay={450}>
            <div className="mt-16 mx-auto max-w-3xl">
              <div className="bg-white rounded-2xl shadow-2xl shadow-gray-200/60 border border-gray-100 overflow-hidden">
                {/* search bar mock */}
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="px-3 py-1.5 bg-brand-50 text-brand-700 rounded-lg border border-brand-200">Hotels</span>
                    <span className="px-3 py-1.5 text-gray-400 rounded-lg">Flights</span>
                    <span className="px-3 py-1.5 text-gray-400 rounded-lg">Cars</span>
                  </div>
                  <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    Washington, DC &middot; Mar 15–18
                  </div>
                </div>
                {/* result preview rows */}
                <div className="divide-y divide-gray-50">
                  {[
                    { name: 'Marriott Crystal City', price: '$109', delta: '+$280', badge: 'Under Budget', color: 'brand', loyalty: 'Bonvoy — ~5,450 pts' },
                    { name: 'Hilton Garden Inn', price: '$119', delta: '+$210', badge: 'Under Budget', color: 'brand', loyalty: 'Honors — ~4,760 pts' },
                    { name: 'Hyatt Place Arlington', price: '$155', delta: '+$42', badge: 'Near Budget', color: 'accent', loyalty: 'World of Hyatt — ~2,325 pts' },
                  ].map((hotel) => (
                    <div key={hotel.name} className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 text-sm truncate">{hotel.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{hotel.loyalty}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          hotel.color === 'brand'
                            ? 'bg-brand-50 text-brand-700'
                            : 'bg-accent-50 text-accent-700'
                        }`}>
                          {hotel.badge}
                        </span>
                        <div className="text-right">
                          <div className="text-sm font-bold text-gray-900">{hotel.price}<span className="text-xs font-normal text-gray-400">/nt</span></div>
                          <div className="text-xs font-semibold text-brand-600">{hotel.delta}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-3 bg-brand-50/50 border-t border-brand-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-brand-700">GSA per diem: Washington, DC — $199/night lodging</span>
                  <span className="text-xs text-brand-600 font-semibold">3 results under budget</span>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="py-16 border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div ref={savings.ref}>
              <div className="text-3xl sm:text-4xl font-extrabold text-brand-600">{savings.display}</div>
              <div className="mt-1 text-sm text-gray-500 font-medium">Average saved per year</div>
            </div>
            <div ref={tracked.ref}>
              <div className="text-3xl sm:text-4xl font-extrabold text-accent-500">
                {parseInt(tracked.display.replace(/[$,]/g, '')) >= 1000000
                  ? `$${(parseInt(tracked.display.replace(/[$,]/g, '')) / 1000000).toFixed(1)}M`
                  : tracked.display
                }+
              </div>
              <div className="mt-1 text-sm text-gray-500 font-medium">Per diem dollars tracked</div>
            </div>
            <div ref={users.ref}>
              <div className="text-3xl sm:text-4xl font-extrabold text-gray-900">{users.display}+</div>
              <div className="mt-1 text-sm text-gray-500 font-medium">Travelers on the waitlist</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              How Perdiemify works
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
              Three steps to maximize your per diem. Every trip, every time.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
            {steps.map((step, i) => (
              <FadeIn key={step.num} delay={i * 150}>
                <div className="relative text-center">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-500 text-white text-2xl font-bold flex items-center justify-center shadow-lg shadow-brand-500/25">
                    {step.num}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="hidden md:block absolute top-7 left-[calc(50%+40px)] w-[calc(100%-80px)] border-t-2 border-dashed border-brand-200" />
                  )}
                  <h3 className="mt-5 text-lg font-bold text-gray-900">{step.title}</h3>
                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">{step.description}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-20 sm:py-28 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              Everything you need to maximize per diem
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
              Built by per diem travelers, for per diem travelers.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <FadeIn key={feature.title} delay={i * 80}>
                <div className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg hover:border-brand-200 hover:-translate-y-1 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-gray-900">{feature.title}</h3>
                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">{feature.description}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WHO IT'S FOR ─── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              Built for per diem travelers
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
              Whether you travel for the government, military, or private sector — if you get per diem, this is for you.
            </p>
          </FadeIn>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: '🏛️', label: 'Government / Federal', sub: 'GSA per diem rates', stat: '~350K travelers' },
              { icon: '🎖️', label: 'Military (TDY/PCS)', sub: 'JTR per diem rates', stat: '~500K active TDY' },
              { icon: '🏢', label: 'Corporate', sub: 'Company policy rates', stat: 'Custom per diems' },
              { icon: '🔧', label: 'Contractors', sub: 'Client per diem', stat: 'Defense & civilian' },
            ].map((segment, i) => (
              <FadeIn key={segment.label} delay={i * 100}>
                <div className="text-center bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200 transition-all">
                  <div className="text-3xl mb-3">{segment.icon}</div>
                  <div className="font-bold text-gray-900 text-sm">{segment.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{segment.sub}</div>
                  <div className="text-xs text-brand-600 font-medium mt-2">{segment.stat}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-20 sm:py-28 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              What travelers are saying
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <FadeIn key={t.name} delay={i * 120}>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <svg key={j} className="w-4 h-4 text-accent-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.role}</div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
              Start free. Upgrade when you&apos;re ready. Cancel anytime.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricingTiers.map((tier, i) => (
              <FadeIn key={tier.name} delay={i * 120}>
                <div
                  className={`relative rounded-2xl p-6 border-2 transition-all ${
                    tier.popular
                      ? 'border-brand-500 shadow-xl shadow-brand-500/10 scale-[1.02]'
                      : 'border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200'
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                      Most Popular
                    </div>
                  )}
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-bold text-gray-900">{tier.name}</h3>
                    <div className="mt-2">
                      <span className="text-4xl font-extrabold text-gray-900">{tier.price}</span>
                      <span className="text-sm text-gray-400 font-medium">{tier.period}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">{tier.description}</p>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                        <svg className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={`w-full py-3 text-sm font-semibold rounded-xl transition-all ${
                      tier.popular
                        ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/25'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {tier.cta}
                  </button>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA / WAITLIST ─── */}
      <section id="signup" className="py-20 sm:py-28 bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 relative overflow-hidden">
        <div className="absolute inset-0 -z-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 rounded-full border border-white" />
          <div className="absolute bottom-10 right-10 w-60 h-60 rounded-full border border-white" />
          <div className="absolute top-1/2 left-1/3 w-20 h-20 rounded-full border border-white" />
        </div>
        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Ready to keep the difference?
            </h2>
            <p className="mt-4 text-lg text-brand-100">
              Join thousands of per diem travelers already on the waitlist.
              Be the first to know when we launch.
            </p>
          </FadeIn>

          <FadeIn delay={150}>
            <div className="mt-10 max-w-md mx-auto">
              {submitted ? (
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
                  <div className="text-3xl mb-2">🎉</div>
                  <p className="text-white font-semibold text-lg">You&apos;re on the list!</p>
                  <p className="text-brand-100 text-sm mt-1">We&apos;ll let you know the moment Perdiemify launches.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="flex-1 px-4 py-3.5 rounded-xl bg-white/10 backdrop-blur-sm border-2 border-white/20 focus:border-white/50 focus:outline-none text-white placeholder:text-brand-200 transition-all"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3.5 bg-white hover:bg-gray-50 text-brand-600 font-bold rounded-xl transition-all shadow-lg hover:-translate-y-0.5"
                  >
                    Join Waitlist
                  </button>
                </form>
              )}
              <p className="text-sm text-brand-200 mt-3">Free forever plan available. No credit card required.</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
            {/* brand */}
            <div className="sm:col-span-2">
              <div className="text-xl font-extrabold tracking-tight">
                <span className="text-gradient">Perdiemify</span>
              </div>
              <p className="mt-3 text-sm text-gray-500 max-w-xs leading-relaxed">
                The smartest way to maximize your per diem. Search, compare, save — keep every dollar you deserve.
              </p>
            </div>
            {/* links */}
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#features" className="hover:text-brand-600 transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-brand-600 transition-colors">Pricing</a></li>
                <li><Link href="/search" className="hover:text-brand-600 transition-colors">Search</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-brand-600 transition-colors">About</a></li>
                <li><a href="#" className="hover:text-brand-600 transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-brand-600 transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} Perdiemify. All rights reserved.</p>
            <p className="text-sm text-gray-400 font-medium">Keep the difference.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
