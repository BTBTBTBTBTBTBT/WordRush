import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Six — Wordocious',
  description: 'Guess the 6-letter word in 7 tries. A bigger challenge for word game masters.',
  openGraph: {
    title: 'Six — Wordocious',
    description: 'Guess the 6-letter word in 7 tries. A bigger challenge for word game masters.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
