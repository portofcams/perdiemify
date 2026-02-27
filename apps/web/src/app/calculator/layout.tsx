import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Per Diem Calculator — Perdiemify',
  description: 'Free GSA per diem rate calculator. Look up lodging and M&IE rates for any US city. Calculate your total travel allowance instantly.',
  openGraph: {
    title: 'Per Diem Calculator — Perdiemify',
    description: 'Free GSA per diem rate calculator. Look up rates for any US city.',
  },
};

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
