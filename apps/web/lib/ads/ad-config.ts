export const AD_CONFIG = {
  /** Master switch — set NEXT_PUBLIC_ADS_ENABLED=true in Vercel env to activate */
  enabled: process.env.NEXT_PUBLIC_ADS_ENABLED === 'true',

  // 2026-09-23: the AdSense publisher/slot ids (NEXT_PUBLIC_ADSENSE_CLIENT_ID,
  // NEXT_PUBLIC_AD_INTERSTITIAL_SLOT, NEXT_PUBLIC_AD_BANNER_SLOT) are gone —
  // both accounts are permanently closed and no component reads them. A new
  // web provider adds its own public slot config here, next to the switch.

  /** Seconds the countdown runs before "Continue" button appears */
  countdownSeconds: 5,

  /** Max ms to wait for an ad to load before auto-continuing */
  loadTimeoutMs: 8000,
};
