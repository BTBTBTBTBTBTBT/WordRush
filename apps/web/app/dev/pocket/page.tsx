import { notFound } from 'next/navigation';
import { PocketDemoClient } from './client';

// DEV-ONLY (founder 10-13 perf harness): /dev/pocket?kind=rps|ttt|coin|pass|passfull|ghost|chain[&autoplay=1][&pace=3500].
// Refused outside `next dev`. See lib/pocket-demo.ts.
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: { kind?: string; autoplay?: string; pace?: string } }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <PocketDemoClient kind={searchParams.kind ?? 'rps'} autoplay={searchParams.autoplay === '1'} pace={Number(searchParams.pace) || 3500} />;
}
