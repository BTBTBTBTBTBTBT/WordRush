import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Crosswordocious — Wordocious',
  description: 'A daily themed fill-in-the-blank crossword: every clue is a familiar saying with one word missing. Fill the grid, check when you dare. One puzzle a day, the same for everyone.',
  openGraph: {
    title: 'Crosswordocious — Wordocious',
    description: 'A daily themed fill-in-the-blank crossword: every clue is a familiar saying with one word missing. Fill the grid, check when you dare. One puzzle a day, the same for everyone.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
