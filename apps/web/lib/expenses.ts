/**
 * The Wordocious infrastructure ledger — every service the product runs on,
 * its plan, and its cost. ONE source of truth, rendered at /admin/expenses.
 *
 * Costs change rarely, and most billing APIs don't expose plan/price reads,
 * so this is deliberately a maintained file rather than a live query — but
 * honestly labeled: `verified: false` rows are best-effort estimates awaiting
 * a founder check against the actual billing console, and totals only count
 * verified rows. When a plan changes, change it HERE (grep for the service).
 */
export interface ExpenseItem {
  service: string;
  purpose: string;
  plan: string;
  /** USD per month; yearly and one-time costs use their own fields. */
  monthly?: number;
  yearly?: number;
  oneTime?: number;
  /** Usage-based notes (Stripe percentage, overage risk, etc.). */
  note?: string;
  /** true = founder-confirmed amount; false = estimate pending confirmation. */
  verified: boolean;
  /** Where to check/change the bill. */
  billingUrl: string;
  /** Which login owns it (the account-sprawl map). */
  account: string;
}

export const EXPENSES: ExpenseItem[] = [
  {
    service: 'Vercel',
    purpose: 'Web hosting, crons, env, deploys (project wordocious)',
    plan: 'Pro',
    monthly: 20,
    note: '$20/seat/month, 1 seat. Upgraded from Hobby 2026-07 (hourly crons + limits).',
    verified: true,
    billingUrl: 'https://vercel.com/account/billing',
    account: 'bterchin-1609 (personal)',
  },
  {
    service: 'Apple Developer Program',
    purpose: 'iOS distribution (team Q32F6GRDYG)',
    plan: 'Individual membership',
    yearly: 99,
    verified: true,
    billingUrl: 'https://developer.apple.com/account',
    account: 'personal Apple ID',
  },
  {
    service: 'Google Play Console',
    purpose: 'Android distribution (org ShowLoud)',
    plan: 'Developer registration',
    oneTime: 25,
    note: 'One-time, already paid.',
    verified: true,
    billingUrl: 'https://play.google.com/console',
    account: 'ShowLoud org',
  },
  {
    service: 'Stripe',
    purpose: 'Web Pro billing',
    plan: 'Standard (pay-as-you-go)',
    monthly: 0,
    note: '2.9% + 30¢ per successful charge; no fixed fee.',
    verified: true,
    billingUrl: 'https://dashboard.stripe.com/settings/billing',
    account: 'ShowLoud LLC entity',
  },
  {
    service: 'Supabase',
    purpose: 'Postgres + Auth + RLS (eniiqqsxpmuyrspvepiw)',
    plan: 'Free Plan',
    monthly: 0,
    note: 'Verified in dashboard 2026-08-01 (org BTBTBTBTBTBTBT, 5 projects). Free caps: 500MB DB / 50k MAU, and NO point-in-time backups — upgrade to Pro ($25/mo) is the first bill worth paying once revenue starts.',
    verified: true,
    billingUrl: 'https://supabase.com/dashboard/org/_/billing',
    account: 'personal handle',
  },
  {
    service: 'Railway',
    purpose: 'VS socket server (auto-deploy from main)',
    plan: 'Hobby (assumed)',
    monthly: 5,
    note: 'CONFIRM: not signed in to Railway in this browser (GitHub SSO). Hobby is $5/mo including $5 of usage; VS traffic beyond that bills as usage.',
    verified: false,
    billingUrl: 'https://railway.com/workspace/billing',
    account: 'GitHub SSO — confirm',
  },
  {
    service: 'wordocious.com domain',
    purpose: 'The domain',
    plan: 'GoDaddy annual registration',
    yearly: 22,
    note: 'Registrar verified via WHOIS 2026-08-01: GoDaddy. CONFIRM exact renewal price in the GoDaddy console (.com renewals typically ~$22/yr).',
    verified: false,
    billingUrl: 'https://account.godaddy.com/products',
    account: 'GoDaddy login — confirm which email',
  },
  {
    service: 'Microsoft 365',
    purpose: 'bt@showloud.com + jp mailboxes (showloud.com MX → Outlook, verified via DNS 2026-08-01)',
    plan: 'Business Basic (assumed)',
    monthly: 6,
    note: 'CONFIRM plan + seat count at admin.microsoft.com (Business Basic is $6/user/mo annual). NOT Google Workspace — bt@showloud is a Google *account* but the mailbox is Microsoft.',
    verified: false,
    billingUrl: 'https://admin.microsoft.com/#/subscriptions',
    account: 'bt@showloud (Microsoft)',
  },
  {
    service: 'Google Cloud / Firebase',
    purpose: 'OAuth, FCM push, Test Lab (spellstrike-490819)',
    plan: 'Free tier',
    monthly: 0,
    note: 'FCM free; Test Lab free daily quota (5 physical + 10 virtual runs). A paid Test Lab burst would be ~$1–5/device-hour if ever needed.',
    verified: true,
    billingUrl: 'https://console.cloud.google.com/billing',
    account: 'bterchin@gmail',
  },
  {
    service: 'Sentry',
    purpose: 'Crash + error reporting (3 platforms)',
    plan: 'Developer (free)',
    monthly: 0,
    note: 'Verified 2026-08-01: 172/5,000 errors used this period, no card on file. Team is $26/mo if ever needed.',
    verified: true,
    billingUrl: 'https://showloud-llc.sentry.io/settings/billing/overview/',
    account: 'org showloud-llc',
  },
  {
    service: 'AdMob / AdSense / APNs / Relay',
    purpose: 'Ad revenue, push delivery, business banking',
    plan: 'Free',
    monthly: 0,
    note: 'Revenue-side or free services — no cost.',
    verified: true,
    billingUrl: 'https://apps.admob.com',
    account: 'mixed (see account map)',
  },
];

export function expenseTotals(items: ExpenseItem[]) {
  const verified = items.filter((i) => i.verified);
  const unverified = items.filter((i) => !i.verified);
  const monthly = verified.reduce((a, i) => a + (i.monthly ?? 0) + (i.yearly ?? 0) / 12, 0);
  const unverifiedMonthly = unverified.reduce((a, i) => a + (i.monthly ?? 0) + (i.yearly ?? 0) / 12, 0);
  return {
    verifiedMonthly: monthly,
    verifiedYearly: monthly * 12,
    unverifiedMonthlyEstimate: unverifiedMonthly,
    oneTimeTotal: items.reduce((a, i) => a + (i.oneTime ?? 0), 0),
  };
}
