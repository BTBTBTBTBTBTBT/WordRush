export const AD_CONFIG = {
  /** Master switch — set NEXT_PUBLIC_ADS_ENABLED=true in Vercel env to activate */
  enabled: process.env.NEXT_PUBLIC_ADS_ENABLED === 'true',

  /** Google AdSense publisher ID (ca-pub-XXXXXXXXXXXXXXXX) */
  adSenseClientId: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || '',

  /** AdSense ad-unit / slot ID for the interstitial */
  interstitialSlotId: process.env.NEXT_PUBLIC_AD_INTERSTITIAL_SLOT || '',

  /** Seconds the countdown runs before "Continue" button appears */
  countdownSeconds: 5,

  /** Max ms to wait for an ad to load before auto-continuing */
  loadTimeoutMs: 8000,
};
