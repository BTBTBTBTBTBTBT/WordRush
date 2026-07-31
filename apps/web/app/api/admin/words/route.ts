import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { isBlockedWordOfDay } from '@wordle-duel/core';
import {
  candidateWords,
  dateKey,
  daysSinceEpoch,
  dictEntry,
  solutionsForDate,
  wordOfDay,
} from '@/lib/word-of-day';

// Upcoming Word of the Day schedule — founder visibility into the pipeline the
// players will see. Everything here is derived from the same lib/word-of-day.ts
// module that renders the home card and the /word archive, so what this page
// predicts is by construction what ships.
//
// Mechanic in one line: index = daysSinceEpoch % solutions.length, so when the
// index walks off the end of the list it wraps to word #1 and the whole list
// replays in order (~4.75 years per cycle at 1,734 words). A day's FEATURED
// word walks forward from that index past any candidate that is blocklisted or
// has no dictionary definition — those skips are reported per-day here.
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get('days')) || 45, 1), 120);
  const today = new Date();

  const upcoming = await Promise.all(
    Array.from({ length: days }, async (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const list = solutionsForDate(d);
      const index = ((daysSinceEpoch(d) % list.length) + list.length) % list.length;

      // Walk the same candidates the card walks, recording why each was skipped.
      const skipped: { word: string; reason: 'blocklist' | 'no definition' }[] = [];
      for (const w of candidateWords(d)) {
        if (dictEntry(w)) break;
        skipped.push({ word: w, reason: isBlockedWordOfDay(w) ? 'blocklist' : 'no definition' });
      }

      const entry = await wordOfDay(d);
      return {
        date: dateKey(d),
        index,
        word: entry.word,
        partOfSpeech: entry.partOfSpeech ?? '',
        definition: entry.definition ?? '',
        skipped,
      };
    }),
  );

  const list = solutionsForDate(today);
  const position = ((daysSinceEpoch(today) % list.length) + list.length) % list.length;
  const wrapInDays = list.length - position;
  const wrap = new Date(today.getFullYear(), today.getMonth(), today.getDate() + wrapInDays);

  return NextResponse.json({
    meta: {
      listLength: list.length,
      position: position + 1, // 1-based "day N of M" for display
      wrapInDays,
      wrapDate: dateKey(wrap),
      cycleYears: Number((list.length / 365.25).toFixed(2)),
    },
    upcoming,
  });
}
