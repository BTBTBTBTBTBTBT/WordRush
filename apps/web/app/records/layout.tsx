import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboards — Wordocious',
  description: 'See who tops the leaderboards across every game mode. Daily and all-time rankings.',
  openGraph: {
    title: 'Leaderboards — Wordocious',
    description: 'See who tops the leaderboards across every game mode. Daily and all-time rankings.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
