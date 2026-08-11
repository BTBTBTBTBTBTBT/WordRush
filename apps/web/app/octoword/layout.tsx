import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OctoWord — Wordocious',
  description: 'Solve 8 words at once in 13 guesses. The ultimate multi-board word challenge.',
  openGraph: {
    title: 'OctoWord — Wordocious',
    description: 'Solve 8 words at once in 13 guesses. The ultimate multi-board word challenge.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
