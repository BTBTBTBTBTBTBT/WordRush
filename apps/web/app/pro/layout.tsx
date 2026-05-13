import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Go Pro — Wordocious',
  description: 'Unlimited daily plays, ad-free gameplay, and exclusive features. Upgrade to Wordocious Pro.',
  openGraph: {
    title: 'Go Pro — Wordocious',
    description: 'Unlimited daily plays, ad-free gameplay, and exclusive features. Upgrade to Wordocious Pro.',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
