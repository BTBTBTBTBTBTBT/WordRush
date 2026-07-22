// Sentry browser-side initialization. Loaded automatically by withSentryConfig
// (injected into the client bundle at build time).
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    'https://56d3dd8a795941b87e030ef7a2c87540@o4511355315748865.ingest.us.sentry.io/4511779215704064',

  // Only report from production builds — keep dev noise out of the project.
  enabled: process.env.NODE_ENV === 'production',

  // Errors only — no performance tracing (avoids burning the transaction quota).
  tracesSampleRate: 0,

  // Don't spam the console in production.
  debug: false,
});
