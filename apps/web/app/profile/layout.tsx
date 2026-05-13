import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile — Wordocious',
  description: 'View your stats, streaks, medals, and game history across all modes.',
  openGraph: {
    title: 'Profile — Wordocious',
    description: 'View your stats, streaks, medals, and game history across all modes.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
