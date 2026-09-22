import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Starsweep — Wordocious',
  description: 'A daily star-placement logic puzzle: one star in every row, column and colour region, none touching. Three mistakes, one board a day, the same for everyone.',
  openGraph: {
    title: 'Starsweep — Wordocious',
    description: 'A daily star-placement logic puzzle: one star in every row, column and colour region, none touching. Three mistakes, one board a day, the same for everyone.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
