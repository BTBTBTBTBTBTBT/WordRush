import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Succession — Wordocious',
  description: '4 words in sequence. Solve one to unlock the next. 10 guesses total.',
  openGraph: {
    title: 'Succession — Wordocious',
    description: '4 words in sequence. Solve one to unlock the next. 10 guesses total.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
