import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Go Pro — Wordocious',
  description: 'Unlimited replays of every game, VS in every mode, streak shields, Pro stats and more. Upgrade to Wordocious Pro.',
  openGraph: {
    title: 'Go Pro — Wordocious',
    description: 'Unlimited replays of every game, VS in every mode, streak shields, Pro stats and more. Upgrade to Wordocious Pro.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
