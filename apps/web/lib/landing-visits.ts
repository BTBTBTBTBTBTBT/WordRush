import { supabase } from './supabase-client';
import { SHARE_SOURCE } from './admin/share-analytics';

export { SHARE_SOURCE };

/**
 * Share-outcome instrumentation (JP, 2026-09-23: "what was the outcome" of
 * the shares). Two landing pages receive shared links — /s/<key> (result and
 * leaderboard cards) and /join/<CODE> (referral gift invites) — and until now
 * neither left a trace, so the admin Marketing page could count shares sent
 * but never shares that landed.
 *
 * logLandingVisit: fire-and-forget insert into public.landing_visits
 * (manual-migration 20260923000001; anon insert policy, no client SELECT —
 * the same stance as share_events). Runs only in a real browser: social
 * scrapers fetch the HTML for the unfurl without executing JS, so they never
 * count, and a crude UA guard drops headless crawlers that do. Never throws,
 * never blocks the page.
 *
 * stampShareFirstTouch: drops the SAME first-touch cookie the /go/<slug>
 * marketing redirects drop (wr_src), with the value 'share'. auth-context
 * already stamps wr_src onto BRAND-NEW accounts as profiles.signup_source
 * (null-only, minutes-old guard), so a visitor who lands on a shared card and
 * creates an account shows up as signup_source='share' with no other change.
 * First touch wins: an existing wr_src (a /go channel) is left alone.
 */

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|twitterbot|linkedinbot|pinterest|whatsapp|telegrambot|discordbot|slackbot|embedly|quora link preview|headless/i;

export type LandingPage = 'share' | 'join';

export function isLikelyBot(ua: string | undefined): boolean {
  return !ua || BOT_UA.test(ua);
}

export function logLandingVisit(page: LandingPage, ref: string): void {
  if (typeof window === 'undefined') return;
  if (isLikelyBot(navigator.userAgent) || (navigator as { webdriver?: boolean }).webdriver) return;
  void (async () => {
    try {
      await (supabase as any).from('landing_visits').insert({
        page,
        ref: (ref || '').slice(0, 64),
      });
    } catch {
      /* analytics must never break a landing page */
    }
  })();
}

export function stampShareFirstTouch(): void {
  if (typeof document === 'undefined') return;
  try {
    if (/(?:^|;\s*)wr_src=/.test(document.cookie)) return; // first channel wins
    document.cookie = `wr_src=${SHARE_SOURCE}; max-age=${60 * 60 * 24 * 30}; path=/; SameSite=Lax`;
  } catch {
    /* cookie blocked — attribution is best-effort */
  }
}
