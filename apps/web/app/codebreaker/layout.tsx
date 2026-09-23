import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Codebreaker — Wordocious',
  description: 'A daily cryptogram: crack the coded saying by working out which letter stands for which. Three letters given, pencil freely, check when you dare. One code a day, the same for everyone.',
  openGraph: {
    title: 'Codebreaker — Wordocious',
    description: 'A daily cryptogram: crack the coded saying by working out which letter stands for which. Three letters given, pencil freely, check when you dare. One code a day, the same for everyone.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
