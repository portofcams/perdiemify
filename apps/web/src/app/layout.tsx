import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Perdiemify — Keep the Difference',
  description:
    'Maximize your per diem allowances. Search flights, hotels, and cars — see exactly how much you pocket. Built for government, military, and corporate travelers.',
  keywords: [
    'per diem',
    'travel savings',
    'GSA per diem',
    'government travel',
    'military TDY',
    'hotel search',
    'flight search',
    'per diem calculator',
  ],
  openGraph: {
    title: 'Perdiemify — Keep the Difference',
    description: 'Maximize your per diem allowances. See exactly how much you pocket on every trip.',
    siteName: 'Perdiemify',
    type: 'website',
    url: 'https://perdiemify.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Perdiemify — Keep the Difference',
    description: 'Maximize your per diem allowances.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#10b981',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
