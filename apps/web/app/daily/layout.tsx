import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Daily Challenge — Wordocious',
  description: 'Play all 9 daily word puzzles. Same words for everyone — compare your results.',
  openGraph: {
    title: 'Daily Challenge — Wordocious',
    description: 'Play all 9 daily word puzzles. Same words for everyone — compare your results.',
  },
};

// §229: the crawlable content for /daily lives in components/auth/daily-landing.tsx,
// rendered by AuthGate for signed-out visitors and crawlers — this layout
// never renders on the server for them (the gate sits above it).
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
