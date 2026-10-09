// Sentry browser-side initialization. Loaded automatically by withSentryConfig
// (injected into the client bundle at build time).
//
// 13+ age check (FRIDAY-QUEUE item 29): crash reporting starts only AFTER the age check passes, so a
// device that has not passed (new visitor, or an under-13 answer) never initializes Sentry. The
// age-check gate calls startSentry() the moment an answer passes (lib/sentry-start.ts).
import { startSentry } from './lib/sentry-start';

try {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('wordocious-age-check') : null;
  if (raw && JSON.parse(raw)?.state === 'ok') startSentry();
} catch {
  // storage blocked: no crash reporting (fail closed)
}
