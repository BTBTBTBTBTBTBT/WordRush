// Next.js instrumentation hook — routes Sentry init to the correct runtime.
// Requires experimental.instrumentationHook: true in next.config.js (Next 13).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
