// Sentry starts only after the 13+ age check passes (FRIDAY-QUEUE item 29: no crash reports for an
// under-13 visitor). sentry.client.config.ts calls startSentry() at load when this device already
// passed; the age-check gate calls it the moment a new answer passes (or when the age_check
// off-switch is off). Idempotent.
import * as Sentry from '@sentry/nextjs';

let started = false;

export function startSentry(): void {
  if (started) return;
  started = true;
  Sentry.init({
    dsn:
      process.env.NEXT_PUBLIC_SENTRY_DSN ??
      'https://56d3dd8a795941b87e030ef7a2c87540@o4511355315748865.ingest.us.sentry.io/4511779215704064',
    // Only report from production builds — keep dev noise out of the project.
    enabled: process.env.NODE_ENV === 'production',
    // Errors only — no performance tracing (avoids burning the transaction quota).
    tracesSampleRate: 0,
    debug: false,
  });
}
