import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kindred — Wordocious',
  description: 'A daily groups-of-four puzzle: sixteen words hide four groups with something in common. Find them all with four mistakes to spare. One puzzle a day, the same for everyone.',
  openGraph: {
    title: 'Kindred — Wordocious',
    description: 'A daily groups-of-four puzzle: sixteen words hide four groups with something in common. Find them all with four mistakes to spare. One puzzle a day, the same for everyone.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
