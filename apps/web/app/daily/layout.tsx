import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Daily Challenge — Wordocious',
  description: 'Play all 9 daily word puzzles. Same words for everyone — compare your results.',
  openGraph: {
    title: 'Daily Challenge — Wordocious',
    description: 'Play all 9 daily word puzzles. Same words for everyone — compare your results.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
