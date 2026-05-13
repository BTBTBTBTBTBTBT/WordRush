import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gauntlet — Wordocious',
  description: '5 stages of increasing difficulty — Classic through OctoWord. Survive them all.',
  openGraph: {
    title: 'Gauntlet — Wordocious',
    description: '5 stages of increasing difficulty — Classic through OctoWord. Survive them all.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
