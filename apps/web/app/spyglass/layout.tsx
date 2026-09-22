import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Spyglass — Wordocious',
  description: 'A daily themed word search: ten words hidden in a 10 × 10 grid, race the clock. One grid a day, the same for everyone.',
  openGraph: {
    title: 'Spyglass — Wordocious',
    description: 'A daily themed word search: ten words hidden in a 10 × 10 grid, race the clock. One grid a day, the same for everyone.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
