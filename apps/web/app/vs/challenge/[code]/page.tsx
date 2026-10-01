'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { VsChallenge } from '@/components/vs/vs-challenge';

/** /vs/challenge/<code> — race a friend's run (VS overhaul §4, components/vs/vs-challenge.tsx). */
export default function VsChallengePage() {
  const params = useParams();
  const code = String(params?.code ?? '').toUpperCase();
  // Suspense: the VS game reads its search params.
  return <Suspense fallback={null}><VsChallenge code={code} /></Suspense>;
}
