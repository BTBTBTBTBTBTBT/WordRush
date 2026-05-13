import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Deliverance — Wordocious',
  description: '4 boards with pre-filled hints. 6 guesses to solve them all.',
  openGraph: {
    title: 'Deliverance — Wordocious',
    description: '4 boards with pre-filled hints. 6 guesses to solve them all.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
