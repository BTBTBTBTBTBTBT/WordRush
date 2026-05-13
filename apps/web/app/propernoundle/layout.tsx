import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ProperNoundle — Wordocious',
  description: 'Guess famous names instead of dictionary words. Themed daily puzzles.',
  openGraph: {
    title: 'ProperNoundle — Wordocious',
    description: 'Guess famous names instead of dictionary words. Themed daily puzzles.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
