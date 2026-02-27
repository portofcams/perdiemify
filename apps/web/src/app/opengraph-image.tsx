import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Perdiemify — Keep the Difference';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Logo area */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '16px',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              fontWeight: 'bold',
              color: 'white',
            }}
          >
            $
          </div>
          <span
            style={{
              fontSize: '48px',
              fontWeight: 800,
              color: 'white',
              letterSpacing: '-0.02em',
            }}
          >
            Perdiemify
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '64px',
            fontWeight: 800,
            color: 'white',
            textAlign: 'center',
            lineHeight: 1.1,
            maxWidth: '900px',
            marginBottom: '24px',
          }}
        >
          Keep the Difference
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '24px',
            color: 'rgba(255,255,255,0.85)',
            textAlign: 'center',
            maxWidth: '700px',
          }}
        >
          Search hotels, flights & cars — see exactly how much you pocket from your per diem allowance.
        </div>

        {/* Stats bar */}
        <div
          style={{
            display: 'flex',
            gap: '48px',
            marginTop: '48px',
            padding: '20px 40px',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.15)',
          }}
        >
          {[
            { label: 'Avg Saved', value: '$4,200' },
            { label: 'Tracked', value: '$2.1M+' },
            { label: 'Travelers', value: '1,800+' },
          ].map((stat) => (
            <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '32px', fontWeight: 800, color: 'white' }}>{stat.value}</span>
              <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
