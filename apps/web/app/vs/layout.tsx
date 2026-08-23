import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VS Lobby — Wordocious',
  description: 'Challenge a friend or find a live opponent.',
  // §229: account-only app screen — nothing for a crawler, and AdSense
  // counted these empty pages (under an ad banner) as low-value content.
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
