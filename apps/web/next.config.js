/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['@wordle-duel/core'],
  experimental: {
    // The App Store webhook reads Apple root certs from ./certs at runtime via a
    // computed path, which Next can't trace statically — force-include them so
    // the serverless function bundle on Vercel actually contains the .cer files.
    outputFileTracingIncludes: {
      '/api/appstore/notifications': ['./certs/**'],
      // The Day Pass verify endpoint reads the same certs at runtime — it must
      // be traced too, or its bundle ships without the .cer and 503s forever.
      '/api/appstore/verify-transaction': ['./certs/**'],
    },
  },
  // Disable source maps in production to reduce bundle size
  productionBrowserSourceMaps: false,
  // Remove the X-Powered-By header
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
    ],
  },
  async headers() {
    return [
      {
        // Cache static assets aggressively (fonts, images, JS/CSS chunks)
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Cache images served through next/image
        source: '/_next/image',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        // Security headers for all routes
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
