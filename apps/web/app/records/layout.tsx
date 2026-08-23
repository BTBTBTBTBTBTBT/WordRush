import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboards — Wordocious',
  description: 'See who tops the leaderboards across every game mode. Daily and all-time rankings.',
  // §229: account-only app screen — nothing for a crawler, and AdSense
  // counted these empty pages (under an ad banner) as low-value content.
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Leaderboards — Wordocious',
    description: 'See who tops the leaderboards across every game mode. Daily and all-time rankings.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
