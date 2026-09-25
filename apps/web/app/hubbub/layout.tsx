import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hubbub — Wordocious',
  description: 'A daily seven-letter hub game: make words of four letters or more that use the center letter, climb the ranks, find the pangram. One hub a day, the same for everyone.',
  openGraph: {
    title: 'Hubbub — Wordocious',
    description: 'A daily seven-letter hub game: make words of four letters or more that use the center letter, climb the ranks, find the pangram. One hub a day, the same for everyone.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
