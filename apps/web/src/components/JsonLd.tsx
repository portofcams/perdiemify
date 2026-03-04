const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://perdiemify.com';

const schemas = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Perdiemify',
    url: siteUrl,
    logo: `${siteUrl}/icons/icon-512.svg`,
    description:
      'Maximize your per diem allowances. Search flights, hotels, and cars — see exactly how much you pocket. Built for government, military, and corporate travelers.',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Perdiemify',
    applicationCategory: 'TravelApplication',
    operatingSystem: 'Web',
    url: siteUrl,
    description:
      'Travel search engine built for per diem travelers. Compare hotels, flights, and cars against your per diem rate.',
    offers: [
      { '@type': 'Offer', price: '0', priceCurrency: 'USD', name: 'Free' },
      { '@type': 'Offer', price: '9.99', priceCurrency: 'USD', name: 'Pro' },
      { '@type': 'Offer', price: '19.99', priceCurrency: 'USD', name: 'Pro+' },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Search', item: `${siteUrl}/search` },
      { '@type': 'ListItem', position: 3, name: 'Per Diem Calculator', item: `${siteUrl}/calculator` },
    ],
  },
];

export function JsonLd() {
  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
