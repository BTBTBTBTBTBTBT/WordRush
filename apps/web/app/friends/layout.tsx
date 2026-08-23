import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Friends — Wordocious',
  description: 'Your friends, the weekly race, and invites.',
  // §229: account-only app screen — nothing for a crawler, and AdSense
  // counted these empty pages (under an ad banner) as low-value content.
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
