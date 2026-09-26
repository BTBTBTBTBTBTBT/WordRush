import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stats — Wordocious',
  description: 'Your day, every game, your records, medals and history — all in one place.',
  // §229: account-only app screen — nothing for a crawler.
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Stats — Wordocious',
    description: 'Your day, every game, your records, medals and history — all in one place.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
