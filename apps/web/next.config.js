/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@perdiemify/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.cloudflare.com' },
    ],
  },
};

module.exports = nextConfig;
