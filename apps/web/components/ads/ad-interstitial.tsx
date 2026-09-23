'use client';

interface AdInterstitialProps {
  onAdLoaded?: () => void;
  onAdFailed?: () => void;
}

/**
 * Interstitial ad unit inside the AdGate overlay — currently renders NOTHING.
 *
 * 2026-09-23: the AdSense display unit (and its "Ad space — coming soon"
 * placeholder) is gone with the closed AdSense accounts. AdGate itself is
 * untouched and still has its web interstitial switched OFF (§229: a forced
 * countdown before the game loads violates every web placement policy), so
 * this component is not reached in production today; it keeps the same props
 * so AdGate compiles unchanged and a future provider can fill it in.
 */
export function AdInterstitial(_props: AdInterstitialProps) {
  return null;
}
