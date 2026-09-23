import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Muddle — Wordocious',
  description: 'A daily scramble: unscramble four words, then use their circled letters to spell the pun that finishes the caption under the cartoon. One puzzle a day, the same for everyone.',
  openGraph: {
    title: 'Muddle — Wordocious',
    description: 'A daily scramble: unscramble four words, then use their circled letters to spell the pun that finishes the caption under the cartoon. One puzzle a day, the same for everyone.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
