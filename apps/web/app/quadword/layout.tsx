import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'QuadWord — Wordocious',
  description: 'Solve 4 words at once in 9 guesses. Each guess applies to all 4 boards.',
  openGraph: {
    title: 'QuadWord — Wordocious',
    description: 'Solve 4 words at once in 9 guesses. Each guess applies to all 4 boards.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
