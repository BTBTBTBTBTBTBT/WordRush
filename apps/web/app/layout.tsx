import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import { Nunito } from 'next/font/google';
import { ThemeProvider } from '@/lib/theme-context';
import { AuthProvider } from '@/lib/auth-context';
import { StreakShieldProvider } from '@/components/providers/streak-shield-provider';
import { DailyCompletionsProvider } from '@/lib/daily-completions-context';
import { SitePresenceProvider } from '@/components/providers/site-presence-provider';
import { DailyBoundaryReload } from '@/components/providers/daily-boundary-reload';
import { ProPromptModal } from '@/components/modals/pro-prompt-modal';
import { WelcomeModal } from '@/components/modals/welcome-modal';
import { SharePreviewHost } from '@/components/share/share-preview-modal';
import { ShareVariantHost } from '@/components/share/share-variant-modal';
import { AuthGate } from '@/components/auth/auth-gate';
import { RotateOverlay } from '@/components/ui/rotate-overlay';
import { PwaProvider } from '@/components/providers/pwa-provider';
import { AppLoaderDismiss } from '@/components/providers/app-loader-dismiss';
import { Toaster } from '@/components/ui/toaster';
import { AdBanner } from '@/components/ads/ad-banner';

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
  title: 'Wordocious — Epic Word Battles',
  description: 'Daily word puzzles and multiplayer showdowns. QuadWord, OctoWord, Sequence, Rescue, Gauntlet, and more.',
  metadataBase: new URL('https://wordocious.com'),
  manifest: '/manifest.json',
  themeColor: '#a78bfa',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Wordocious',
  },
  other: {
    'google-adsense-account': 'ca-pub-3015627373086578',
  },
  openGraph: {
    title: 'Wordocious — Epic Word Battles',
    description: 'Daily word puzzles and multiplayer showdowns. QuadWord, OctoWord, Sequence, Rescue, Gauntlet, and more.',
    url: 'https://wordocious.com',
    siteName: 'Wordocious',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wordocious — Epic Word Battles',
    description: 'Daily word puzzles and multiplayer showdowns. QuadWord, OctoWord, Sequence, Rescue, Gauntlet, and more.',
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
        {/* Branded loading screen — visible until React hydrates and removes it.
            Uses only inline styles so it renders correctly before Tailwind loads. */}
        <div
          id="app-loader"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '16px',
            background: '#f8f7ff',
          }}
        >
          <span
            style={{
              fontSize: '28px',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            WORDOCIOUS
          </span>
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid #ede9f6',
              borderTopColor: '#a78bfa',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin { to { transform: rotate(360deg) } }
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
        {/* Google AdSense — deferred until after page is interactive and idle */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3015627373086578"
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
        <DailyBoundaryReload />
        {/* Dismiss the static #app-loader overlay as soon as React hydrates,
            regardless of auth state. Must live OUTSIDE <AuthGate> — otherwise
            signed-out users (who get <LoginScreen/> instead of children) never
            mount it and are stuck on the loading spinner forever. */}
        <AppLoaderDismiss />
        <AuthProvider>
          <DailyCompletionsProvider>
            <SitePresenceProvider>
              <AuthGate>
                <ThemeProvider>
                  <StreakShieldProvider>
                    {children}
                    <RotateOverlay />
                    <WelcomeModal />
                    <ProPromptModal />
                    <SharePreviewHost />
                    <ShareVariantHost />
                    <PwaProvider />
                    <Toaster />
                    <AdBanner />
                  </StreakShieldProvider>
                </ThemeProvider>
              </AuthGate>
            </SitePresenceProvider>
          </DailyCompletionsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
