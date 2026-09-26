'use client';

import Link from 'next/link';
import { Crown, ChevronRight } from 'lucide-react';

/**
 * Compact "RECORDS →" row on the Stats page — the door to /records while the
 * Records tab is gone (D1) and before its rows fold into the per-game pages
 * and the All-time page (D2 step 3). Twin of FriendsRowLink.
 */
export function RecordsRowLink() {
  return (
    <Link
      href="/records"
      className="flex items-center gap-2.5 p-4 hover:opacity-90 transition-opacity"
      style={{ background: 'var(--color-surface)', border: '1.5px solid #c4b5fd', borderRadius: '20px' }}
    >
      <Crown className="w-5 h-5" style={{ color: '#7c3aed' }} />
      <span
        className="text-base font-black tracking-tight text-transparent bg-clip-text"
        style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
      >
        RECORDS
      </span>
      <span className="flex-1" />
      <ChevronRight className="w-4 h-4" style={{ color: '#7c3aed' }} />
    </Link>
  );
}
