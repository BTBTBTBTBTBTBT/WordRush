import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sudoku — Wordocious',
  description: 'A daily Sudoku with three mistakes, pencil notes and a leaderboard. One puzzle a day, the same for everyone.',
  openGraph: {
    title: 'Sudoku — Wordocious',
    description: 'A daily Sudoku with three mistakes, pencil notes and a leaderboard. One puzzle a day, the same for everyone.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
