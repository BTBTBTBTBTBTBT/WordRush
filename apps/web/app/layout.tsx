import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/lib/theme-context';
import { AuthProvider } from '@/lib/auth-context';
import { StreakShieldProvider } from '@/components/providers/streak-shield-provider';
import { ProPromptModal } from '@/components/modals/pro-prompt-modal';
import { CosmeticProvider } from '@/lib/cosmetics/cosmetic-context';

export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SpellStrike - Epic Word Battles',
  description: 'Compete in vibrant multiplayer word challenges - QuadWord, OctoWord, and more!',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
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
