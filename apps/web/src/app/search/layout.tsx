import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search Hotels, Flights & Cars — Perdiemify',
  description: 'Compare prices against your per diem rate. See exactly how much you pocket on every booking. Hotels, flights, and rental cars with real-time per diem savings.',
  openGraph: {
    title: 'Search Hotels, Flights & Cars — Perdiemify',
    description: 'Compare prices against your per diem rate. See your savings instantly.',
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
