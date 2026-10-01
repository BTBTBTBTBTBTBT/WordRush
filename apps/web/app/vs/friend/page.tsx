'use client';

import { Suspense } from 'react';
import { VsFriend } from '@/components/vs/vs-friend';

/** The Friend page, "Challenge" (VS overhaul §3, components/vs/vs-friend.tsx). */
export default function VsFriendPage() {
  return <Suspense fallback={null}><VsFriend /></Suspense>;
}
