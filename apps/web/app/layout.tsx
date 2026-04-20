import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import { Nunito } from 'next/font/google';
import { ThemeProvider } from '@/lib/theme-context';
import { AuthProvider } from '@/lib/auth-context';
import { StreakShieldProvider } from '@/components/providers/streak-shield-provider';
import { SitePresenceProvider } from '@/components/providers/site-presence-provider';
import { ProPromptModal } from '@/components/modals/pro-prompt-modal';
import { CosmeticProvider } from '@/lib/cosmetics/cosmetic-context';
import { AuthGate } from '@/components/auth/auth-gate';

export const dynamic = 'force-dynamic';

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
    <html lang="en">
      <body className={nunito.className} style={{ backgroundColor: '#f8f7ff' }}>
        {/* Google AdSense — loaded for site verification & ad serving */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3015627373086578"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <AuthProvider>
          <SitePresenceProvider>
            <AuthGate>
              <ThemeProvider>
                <CosmeticProvider>
                  <StreakShieldProvider>
                    {children}
                    <ProPromptModal />
                  </StreakShieldProvider>
                </CosmeticProvider>
              </ThemeProvider>
            </AuthGate>
          </SitePresenceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
