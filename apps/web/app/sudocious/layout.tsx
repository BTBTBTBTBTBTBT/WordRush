import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sudocious — Wordocious',
  description: 'Sudocious is the Wordocious daily sudoku: one classic nine-by-nine grid a day, three mistakes, pencil notes and a leaderboard. The same puzzle for everyone.',
  openGraph: {
    title: 'Sudocious — Wordocious',
    description: 'Sudocious is the Wordocious daily sudoku: one classic nine-by-nine grid a day, three mistakes, pencil notes and a leaderboard. The same puzzle for everyone.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
