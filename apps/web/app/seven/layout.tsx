import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Seven — Wordocious',
  description: 'Guess the 7-letter word in 8 tries. The ultimate word puzzle challenge.',
  openGraph: {
    title: 'Seven — Wordocious',
    description: 'Guess the 7-letter word in 8 tries. The ultimate word puzzle challenge.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
