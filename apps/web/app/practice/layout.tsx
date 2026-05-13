import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Classic — Wordocious',
  description: 'Guess the 5-letter word in 6 tries. The original Wordle formula, daily and unlimited.',
  openGraph: {
    title: 'Classic — Wordocious',
    description: 'Guess the 5-letter word in 6 tries. The original Wordle formula, daily and unlimited.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
