import './globals.css';
import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import { ThemeProvider } from '@/lib/theme-context';
import { AuthProvider } from '@/lib/auth-context';
import { StreakShieldProvider } from '@/components/providers/streak-shield-provider';
import { ProPromptModal } from '@/components/modals/pro-prompt-modal';
import { CosmeticProvider } from '@/lib/cosmetics/cosmetic-context';

export const dynamic = 'force-dynamic';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SpellStrike - Epic Word Battles',
  description: 'Compete in vibrant multiplayer word challenges - QuadWord, OctoWord, and more!',
  metadataBase: new URL('https://spellstrike.vercel.app'),
  manifest: '/manifest.json',
  themeColor: '#a78bfa',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SpellStrike',
  },
  openGraph: {
    title: 'SpellStrike - Epic Word Battles',
    description: 'Compete in vibrant multiplayer word challenges - QuadWord, OctoWord, and more!',
    url: 'https://spellstrike.vercel.app',
    siteName: 'SpellStrike',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SpellStrike - Epic Word Battles',
    description: 'Compete in vibrant multiplayer word challenges - QuadWord, OctoWord, and more!',
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
        <AuthProvider>
          <ThemeProvider>
            <CosmeticProvider>
              <StreakShieldProvider>
                {children}
                <ProPromptModal />
              </StreakShieldProvider>
            </CosmeticProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
