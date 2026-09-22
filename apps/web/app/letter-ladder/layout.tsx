import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Letter Ladder — Wordocious',
  description: 'A daily word ladder: change one letter at a time to climb from the start word to the end word in as few moves as par. One ladder a day, the same for everyone.',
  openGraph: {
    title: 'Letter Ladder — Wordocious',
    description: 'A daily word ladder: change one letter at a time to climb from the start word to the end word in as few moves as par. One ladder a day, the same for everyone.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
