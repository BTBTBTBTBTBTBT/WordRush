import './globals.css';
import './cast-button.css';
import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import { ThemeProvider } from '@/lib/theme-context';
import { themeSkinCss } from '@/lib/theme-kit';
import { ShareSenderSync } from '@/components/providers/share-sender-sync';
import { AuthProvider } from '@/lib/auth-context';
import { StreakShieldProvider } from '@/components/providers/streak-shield-provider';
import { DailyCompletionsProvider } from '@/lib/daily-completions-context';
import { SitePresenceProvider } from '@/components/providers/site-presence-provider';
import { DailyBoundaryReload } from '@/components/providers/daily-boundary-reload';
import { ProPromptModal } from '@/components/modals/pro-prompt-modal';
import { GoProPopupHost } from '@/components/pro/go-pro-popup';
import { ProWelcomeHost } from '@/components/pro/pro-welcome';
import { AchievementUnlockHost } from '@/components/badges/achievement-unlock-host';
import { AchievementWatcher } from '@/components/badges/achievement-watcher';
import { WelcomeModal } from '@/components/modals/welcome-modal';
import { FirstRunTour } from '@/components/onboarding/first-run-tour';
import { SharePreviewHost } from '@/components/share/share-preview-modal';
import { ShareVariantHost } from '@/components/share/share-variant-modal';
import { AuthGate } from '@/components/auth/auth-gate';
import { DataCacheProvider } from '@/components/providers/data-cache-provider';
import { RotateOverlay } from '@/components/ui/rotate-overlay';
import { PwaProvider } from '@/components/providers/pwa-provider';
import { AppLoaderDismiss } from '@/components/providers/app-loader-dismiss';
import { ColdStartIntro } from '@/components/providers/cold-start-intro';
import { SPLASH } from '@/lib/intro';
import { SquishHost } from '@/components/ui/squish-host';
import { CastArtWarmup } from '@/components/ui/cast-art-warmup';
import { HeadingArtWarmup } from '@/components/ui/heading-art';
import { MotionPause } from '@/components/providers/motion-pause';
import { SeasonDocument } from '@/components/ui/season-preview';
import { Toaster } from '@/components/ui/toaster';
import { AdBanner } from '@/components/ads/ad-banner';
import { ReferralRedeemer } from '@/components/referrals/referral-redeemer';
import { ConfirmDialogHost } from '@/components/ui/confirm-dialog';
import { AnnouncementsBanner } from '@/components/ui/announcements-banner';
import { PlayStoreBanner } from '@/components/ui/play-store-banner';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  display: 'swap',
});

// Brand metadata. The og:image / twitter:image tags are emitted
// automatically by Next.js from the file-convention siblings
// `app/opengraph-image.tsx` and `app/twitter-image.tsx` — do NOT also set
// `openGraph.images` or `twitter.images` here, or the explicit metadata
// wins over the dynamic renderer and a stale static PNG gets served.
export const metadata: Metadata = {
  title: 'Wordocious — Daily Word Games',
  description: 'Eight daily word games and ten Puzzles: Classic, Six, Seven, QuadWord, OctoWord, Succession, Deliverance and Gauntlet, plus Muddle, Kindred, Sudocious, Crosswordocious and more. Same puzzles for everyone.',
  metadataBase: new URL('https://wordocious.com'),
  manifest: '/manifest.json',
  themeColor: '#a78bfa',
  // FINISH_SPEC F1: app icon B (the W mascot on the purple→pink gradient),
  // made from docs/design/brand/logo/app-icon-B-1024.png.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Wordocious',
  },
  // iOS Smart App Banner (Safari-only, site-wide): "Open in the Wordocious
  // app / View in App Store". Emits <meta name="apple-itunes-app">. The share
  // pages (app/s/[...key]/page.tsx) additionally set appArgument to their own
  // URL so the banner deep-links via universal links; everywhere else the
  // plain app-id is enough.
  itunes: {
    appId: '6775966055',
  },
  // §252: the google-adsense-account verification tag is gone. It claimed
  // ca-pub-6632322515624356, an account Google terminated on 2026-09-01 with an
  // entity-level ban — publicly asserting ownership of a dead publisher does
  // nothing but misrepresent the site.
  openGraph: {
    title: 'Wordocious — Daily Word Games',
    description: 'Eight daily word games and ten Puzzles: Classic, Six, Seven, QuadWord, OctoWord, Succession, Deliverance and Gauntlet, plus Muddle, Kindred, Sudocious, Crosswordocious and more. Same puzzles for everyone.',
    url: 'https://wordocious.com',
    siteName: 'Wordocious',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wordocious — Daily Word Games',
    description: 'Eight daily word games and ten Puzzles: Classic, Six, Seven, QuadWord, OctoWord, Succession, Deliverance and Gauntlet, plus Muddle, Kindred, Sudocious, Crosswordocious and more. Same puzzles for everyone.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={nunito.className} style={{ backgroundColor: 'var(--color-bg)' }} suppressHydrationWarning>
        {/* The static launch screen (FINISH_SPEC F2): the Home wallpaper color
            with the app-icon W mascot centered, painted before any script runs
            (inline styles only, so it renders before the stylesheet). React
            removes it on hydration; on a cold start at Home the in-app intro
            (ColdStartIntro) takes over from the same spot. */}
        {/* Item 25: Ocean / Forest / Dark as skins, generated from theme-registry.json (surfaces, tiles, button tint, tab dock).
            A stylesheet, so a season's inline surfaces and colorblind mode still win; server-rendered, so no flash. */}
        <style id="theme-skin" dangerouslySetInnerHTML={{ __html: themeSkinCss() }} />
        <div
          id="app-loader"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: SPLASH.background,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SPLASH.icon}
            alt=""
            width={SPLASH.size}
            height={SPLASH.size}
            style={{ width: SPLASH.size, height: SPLASH.size, filter: 'drop-shadow(0 12px 24px rgba(76, 29, 149, 0.25))' }}
          />
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
          /* Fade out once React hydrates */
          #app-loader.loaded {
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
          }
        ` }} />
        {/* Stuck-loader watchdog — runs independently of React. If hydration
            hasn't dismissed the overlay within 8s (dead chunk after a deploy,
            wedged resume, etc.), force ONE reload (sessionStorage guard stops
            loops) so nobody sits frozen on the loading screen. */}
        <script dangerouslySetInnerHTML={{ __html: `
          setTimeout(function () {
            var el = document.getElementById('app-loader');
            if (!el || el.classList.contains('loaded')) return;
            try {
              if (sessionStorage.getItem('wr-loader-retry')) return;
              sessionStorage.setItem('wr-loader-retry', '1');
            } catch (e) {}
            window.location.reload();
          }, 8000);
        ` }} />
        {/* No web ad script is loaded (2026-09-23): both AdSense accounts are
            permanently closed, so the loader that injected adsbygoogle.js for
            free users is gone — a dead publisher serves nothing and the script
            was wasted weight. When a new web provider is chosen, its loader
            belongs inside <AuthProvider> so it can gate on Pro/tester status
            the way the old one did (Pro = no ad script at all). */}
        <DailyBoundaryReload />
        {/* Dismiss the static #app-loader overlay as soon as React hydrates,
            regardless of auth state. Must live OUTSIDE <AuthGate> — otherwise
            signed-out users (who get <LoginScreen/> instead of children) never
            mount it and are stuck on the loading spinner forever. */}
        <AppLoaderDismiss />
        {/* F2: the cold-start intro (session-only, skippable, Reduce Motion = crossfade). */}
        <ColdStartIntro />
        {/* A9: everything tappable squishes (one document listener). */}
        <SquishHost />
        <CastArtWarmup />
        <HeadingArtWarmup />
        <MotionPause />
        <SeasonDocument />
        <AuthProvider>
          <ShareSenderSync />
          <DailyCompletionsProvider>
            <SitePresenceProvider>
              {/* BI19: persisted SWR cache + launch / post-finish prefetch. */}
              <DataCacheProvider>
              <AuthGate>
                <ThemeProvider>
                  <StreakShieldProvider>
                    {children}
                    <RotateOverlay />
                    <WelcomeModal />
                    <FirstRunTour />
                    <ProPromptModal />
                    <GoProPopupHost />
                    <ProWelcomeHost />
                    <AchievementUnlockHost />
                    <AchievementWatcher />
                    <SharePreviewHost />
                    <ShareVariantHost />
                    <PwaProvider />
                    <Toaster />
                    <AdBanner />
                    <ReferralRedeemer />
                    <ConfirmDialogHost />
                    <AnnouncementsBanner />
                    {/* Android install banner — inert until
                        NEXT_PUBLIC_PLAY_STORE_URL is set (Play launch day). */}
                    <PlayStoreBanner />
                  </StreakShieldProvider>
                </ThemeProvider>
              </AuthGate>
              </DataCacheProvider>
            </SitePresenceProvider>
          </DailyCompletionsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
