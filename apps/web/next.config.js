/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@perdiemify/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.cloudflare.com' },
    ],
  },
};

module.exports = nextConfig;
