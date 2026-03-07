'use client';

import { useEffect, useRef } from 'react';

type AdSize = '728x90' | '300x250' | '320x50';

const sizeMap: Record<AdSize, { width: number; height: number }> = {
  '728x90': { width: 728, height: 90 },
  '300x250': { width: 300, height: 250 },
  '320x50': { width: 320, height: 50 },
};

interface AdSlotProps {
  size: AdSize;
  slot: string;
  className?: string;
  tier?: string;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdSlot({ size, slot, className = '', tier }: AdSlotProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded or blocked
    }
  }, []);

  // Hide ads for Pro/Pro+ subscribers
  if (tier === 'pro' || tier === 'proplus') return null;

  const { width, height } = sizeMap[size];
  const publisherId = process.env.NEXT_PUBLIC_ADSENSE_ID;
  if (!publisherId) return null;

  return (
    <div className={`flex justify-center ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'inline-block', width, height }}
        data-ad-client={publisherId}
        data-ad-slot={slot}
      />
    </div>
  );
}
