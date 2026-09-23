'use client';

/**
 * Bottom banner slot for free users — currently renders NOTHING.
 *
 * 2026-09-23: both AdSense accounts are permanently closed (§252), so the
 * AdSense <ins> unit and the adsbygoogle push that lived here are gone along
 * with the loader script. The slot stays mounted in layout.tsx so a new web
 * provider's banner can drop back in without touching the layout, and so
 * BottomNav's --bottom-nav-h contract (the banner stacks above the nav) keeps
 * meaning something.
 *
 * Rules the replacement must keep (they were all here before):
 *   * never for Pro (`isProActive`), never for admin/tester roles (§228 —
 *     tester traffic on live units is what killed the Google accounts),
 *     never on account-only screens (/records, /friends, /vs, /profile — §229),
 *     never outside NODE_ENV=production;
 *   * gate on AD_CONFIG.enabled plus the provider's own slot config;
 *   * include the 61px in-flow spacer so the last rows of scrollable pages can
 *     clear a fixed banner.
 */
export function AdBanner() {
  return null;
}
