const { withSentryConfig } = require('@sentry/nextjs');

// More Games banks → one static JSON per puzzle under public/banks/<game>/<hash>/
// plus lib/banks-manifest.json (founder, 2026-09-29; scripts/split-banks.js).
// Runs whenever Next loads this config (dev, build, start), so the files always
// match data/ without a separate build step. A build must not ship without
// them; anywhere else (a read-only server loading this config) only warns.
try {
  require('./scripts/split-banks').splitBanks();
} catch (e) {
  if (process.argv.includes('build')) throw e;
  console.warn(`split-banks: skipped (${e.message})`);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // /portal is Jasson's short URL for the engineering portal. The real page
  // lives under /admin so middleware.ts's admin gate covers it — this doc
  // describes the whole stack and must never be public.
  async redirects() {
    return [
      { source: '/portal', destination: '/admin/engineering?tab=portal', permanent: false },
      // Admin consolidation 2026-08-02: Content merged into Messaging,
      // Expenses into Revenue — keep old bookmarks working.
      { source: '/admin/content', destination: '/admin/messaging', permanent: false },
      { source: '/admin/expenses', destination: '/admin/revenue', permanent: false },
      // Admin merge 2026-10-14 (28 pages -> 16): old pages are tabs now; keep
      // bookmarks and every in-app link to the old paths working.
      { source: '/admin/words', destination: '/admin/daily?tab=word', permanent: false },
      { source: '/admin/banks', destination: '/admin/daily?tab=banks', permanent: false },
      { source: '/admin/achievements', destination: '/admin/progression?tab=achievements', permanent: false },
      { source: '/admin/avatars', destination: '/admin/progression?tab=avatars', permanent: false },
      { source: '/admin/releases', destination: '/admin/engineering?tab=releases', permanent: false },
      { source: '/admin/portal', destination: '/admin/engineering?tab=portal', permanent: false },
      { source: '/admin/payments', destination: '/admin/pro?tab=members', permanent: false },
      { source: '/admin/referrals', destination: '/admin/pro?tab=gifts', permanent: false },
      { source: '/admin/push-copy', destination: '/admin/messaging?tab=copy', permanent: false },
      { source: '/admin/moderation', destination: '/admin/users?tab=new', permanent: false },
      { source: '/admin/onboarding', destination: '/admin/metrics?tab=activation', permanent: false },
      // Mark scrub 2026-08-11 (§210): our routes must never wear a competitor
      // mark. Old paths 301 so shipped deep links, bookmarks, and indexed
      // URLs keep working while the canonical URL becomes the clean slug.
      { source: '/quordle', destination: '/quadword', permanent: true },
      { source: '/quordle/vs', destination: '/quadword/vs', permanent: true },
      { source: '/octordle', destination: '/octoword', permanent: true },
      { source: '/octordle/vs', destination: '/octoword/vs', permanent: true },
      // Sudocious rename 2026-09-23: the daily sudoku mode is Sudocious (a
      // house coinage like Crosswordocious). The id/dbKey/flag stay 'sudoku'
      // (rename-proof rule); only the player-facing route moves. Next carries
      // the query string (?daily=true) across a redirect by default.
      { source: '/sudoku', destination: '/sudocious', permanent: true },
    ];
  },
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
      // The bible route reads .bible.md (copied in by scripts/copy-bible.mjs
      // during `npm run build`) — same computed-path-at-runtime story as certs.
      '/api/admin/bible': ['./.bible.md'],
      // Rich push pictures (founder 10-10: they never showed — the route read public/ files that weren't in the
      // function bundle and 500'd): the sender's mascot parts, the crown, the game icons and the fallback mascot.
      // sharp loads its native build through a dynamic require the tracer can't follow: include the platform
      // packages (linux-x64 on Vercel; darwin here, so a local build proves the patterns) and sharp's own @img links.
      '/api/push/art/[kind]/[id]': ['./public/art/art-av-*', './public/art/art-badge-*', './public/art/game-*', './public/mascots/**', './lib/push/fonts/**',
        '../../node_modules/.pnpm/sharp@*/node_modules/@img/**',
        '../../node_modules/.pnpm/@img+sharp-linux-x64@*/**', '../../node_modules/.pnpm/@img+sharp-libvips-linux-x64@*/**',
        '../../node_modules/.pnpm/@img+sharp-darwin-arm64@*/**', '../../node_modules/.pnpm/@img+sharp-libvips-darwin-arm64@*/**'],
    },
    // Required on Next 13 so instrumentation.ts runs (Sentry server/edge init).
    instrumentationHook: true,
    // Founder 10-10 (rich push pictures 500'd: "Could not load the 'sharp' module using the linux-x64 runtime"):
    // bundled by webpack, sharp lost its native binaries; loaded from node_modules, the tracer includes them.
    serverComponentsExternalPackages: ['sharp'],
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
        // Muddle cartoons: content-hashed file names (md-<id>-<sha10>.webp), so a
        // year-long immutable cache is safe. Without this Vercel served them with
        // max-age=0 and every native open revalidated (plan §5 asked for immutable).
        source: '/muddle/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Per-puzzle bank files live under a content-hash directory
        // (scripts/split-banks.js), so a URL never changes meaning: immutable.
        source: '/banks/:path*',
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
        // Universal links: Apple's CDN requires the AASA file served as JSON
        // (the extension-less file in public/ would default to octet-stream).
        source: '/.well-known/apple-app-site-association',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        // Security headers for all routes
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // SAMEORIGIN, not DENY: the admin engineering portal renders
          // /admin/portal/doc in a same-origin iframe (a real URL, because
          // srcdoc iframes can't do fragment navigation — bible §196). DENY
          // blocked our own frame and broke the Portal page; SAMEORIGIN keeps
          // the identical protection against third-party clickjacking.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

// Sentry build-time wrapper. No SENTRY_AUTH_TOKEN is configured, so source-map
// upload is disabled explicitly — the build must succeed with no Sentry env vars.
module.exports = withSentryConfig(nextConfig, {
  // Suppress Sentry CLI/build logs (including the missing-auth-token warning).
  silent: true,
  // No auth token → never attempt (or require) source-map upload.
  sourcemaps: {
    disable: true,
  },
  // Don't send build telemetry to Sentry.
  telemetry: false,
  // Keep client bundles lean: strip Sentry debug-log statements in prod builds.
  webpack: {
    treeshake: {
      removeDebugLogging: true,
      // Every Sentry.init has tracesSampleRate: 0 and nothing starts spans, so
      // the tracing code is dead weight in every bundle (founder, 2026-09-29).
      removeTracing: true,
    },
  },
});
