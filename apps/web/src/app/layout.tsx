import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { JsonLd } from '@/components/JsonLd';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://perdiemify.com'),
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
  manifest: '/manifest.json',
  icons: [
    { url: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
    { url: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Perdiemify',
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
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen font-sans">
          <JsonLd />
          {process.env.NEXT_PUBLIC_ADSENSE_ID && (
            <Script
              async
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_ID}`}
              crossOrigin="anonymous"
              strategy="lazyOnload"
            />
          )}
          {children}
          <PWAInstallPrompt />
        </body>
      </html>
    </ClerkProvider>
  );
}
