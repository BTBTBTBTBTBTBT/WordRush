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
import { AuthGate } from '@/components/auth/auth-gate';
import { RotateOverlay } from '@/components/ui/rotate-overlay';
import { PwaProvider } from '@/components/providers/pwa-provider';
import { Toaster } from '@/components/ui/toaster';

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
        {/* Google AdSense — deferred until after page is interactive and idle */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3015627373086578"
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
        <DailyBoundaryReload />
        <AuthProvider>
          <SitePresenceProvider>
            <AuthGate>
              <ThemeProvider>
                <DailyCompletionsProvider>
                  <StreakShieldProvider>
                    {children}
                    <RotateOverlay />
                    <WelcomeModal />
                    <ProPromptModal />
                    <SharePreviewHost />
                    <PwaProvider />
                    <Toaster />
                  </StreakShieldProvider>
                </DailyCompletionsProvider>
              </ThemeProvider>
            </AuthGate>
          </SitePresenceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
