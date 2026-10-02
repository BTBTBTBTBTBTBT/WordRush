'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { SOLUTIONS_CUTOVER_DATE, SOLUTION_SWAP_CUTOVER_DATE, SOLUTION_SWAP_2_CUTOVER_DATE, SOLUTION_SWAPS, SOLUTION_SWAPS_2 } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { fetchQuizState, saveQuizAnswer, type QuizAnswer } from '@/lib/home-streaks';
import { HomeSectionTitle } from '@/components/home/home-section-title';
import { onPageShadow } from '@/lib/art';

// Word of the Day, now a three-choice quiz (founder-approved home redesign,
// 2026-10-01). Before answering, the definition is hidden behind three choices
// (one real; /api/wotd picks the same two decoys for everyone each day). A tap
// shows a ~2 s right/wrong beat, then the card settles into the ordinary card
// with ONLY the real definition, plus a small flame and the word streak after a
// right answer. The wrong choices never come back that day.
//
// Art pass §12 (docs/ART_SPEC.md): the WORD OF THE DAY title art sits OUT of
// the card, as a Home section header above it (same size as PUZZLES), with
// "Past words" at the right of that header row; the card keeps its content.

interface WordInfo {
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition?: string;
  choices?: string[] | null;
  answer?: number | null;
  quizPartOfSpeech?: string | null;
}

/** Offline fallback: same index math as lib/word-of-day.ts, including the §265 answer swaps. */
function offlineWotd(list: string[], dayIndex: number, dayKey: string): string {
  let w = list[dayIndex % list.length];
  if (dayKey >= SOLUTION_SWAP_CUTOVER_DATE) w = SOLUTION_SWAPS[w.toUpperCase()] ?? w;
  if (dayKey >= SOLUTION_SWAP_2_CUTOVER_DATE) w = SOLUTION_SWAPS_2[w.toUpperCase()] ?? w;
  return w;
}

const LETTERS = ['A', 'B', 'C'];
const CARD_STYLE: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '14px', boxShadow: onPageShadow(),
};

/** The section: the header row (title art + Past words) above the card. */
function WotdSection({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="Word of the Day">
      <HomeSectionTitle
        name="art-title-wotd"
        label="Word of the Day"
        trailing={(
          <Link href="/words" className="text-[10px] font-bold hover:underline" style={{ color: '#8b5cf6' }}>
            Past words →
          </Link>
        )}
      />
      {children}
    </section>
  );
}
const REVEAL_MS = 2200;

export function WordOfTheDay() {
  const { user } = useAuth();
  const [info, setInfo] = useState<WordInfo | null>(null);
  const [answer, setAnswer] = useState<QuizAnswer | null>(null);
  const [answerLoaded, setAnswerLoaded] = useState(false);
  const [streak, setStreak] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const now = new Date();
  // Day index of the LOCAL calendar date (Date.UTC on the local Y/M/D), the same
  // index the /word/[date] archive uses, so the card and the archive always agree.
  const daysSinceEpoch = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    const useLegacy = dayKey < SOLUTIONS_CUTOVER_DATE;
    // v2: the cached entry carries the quiz choices; v1 entries (definition only) are skipped.
    const cacheKey = `wordocious-wotd-v2-${daysSinceEpoch}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const v = JSON.parse(cached) as WordInfo;
        if (v?.word && v.definition) { setInfo(v); return; }
      }
    } catch {}
    let cancelled = false;
    const offline = async () => {
      const solutions = useLegacy
        ? (await import('@/data/solutions-legacy.json')).default
        : (await import('@/data/solutions.json')).default;
      if (!cancelled) setInfo({ word: offlineWotd(solutions, daysSinceEpoch, dayKey) });
    };
    fetch(`/api/wotd?date=${dayKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((v: WordInfo | null) => {
        if (cancelled) return;
        if (v?.word) {
          setInfo(v);
          if (v.definition) { try { localStorage.setItem(cacheKey, JSON.stringify(v)); } catch {} }
          return;
        }
        return offline();
      })
      .catch(() => { if (!cancelled) offline(); });
    return () => { cancelled = true; };
  }, [dayKey, daysSinceEpoch]);

  useEffect(() => {
    let cancelled = false;
    setAnswerLoaded(false);
    fetchQuizState(user?.id ?? null, dayKey)
      .then((s) => { if (!cancelled) { setAnswer(s.today); setStreak(s.streak); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAnswerLoaded(true); });
    return () => { cancelled = true; };
  }, [user?.id, dayKey]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!info) return (
    <WotdSection>
      <div className="px-3 py-2 animate-pulse" style={CARD_STYLE}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-3 h-3 rounded" style={{ background: 'var(--color-border)' }} />
          <div className="h-2.5 w-24 rounded" style={{ background: 'var(--color-border)' }} />
        </div>
        <div className="h-4 w-32 rounded mb-1" style={{ background: 'var(--color-border)' }} />
        <div className="h-3 w-48 rounded" style={{ background: 'var(--color-border)' }} />
      </div>
    </WotdSection>
  );

  const quiz = info.choices && info.choices.length === 3 && info.answer != null ? { choices: info.choices, answer: info.answer } : null;
  const asking = !!quiz && answerLoaded && !answer;
  // With a quiz, the definition stays hidden until we know the player has answered (never flash it).
  const settled = !quiz || (answerLoaded && !!answer);
  const definition = quiz ? quiz.choices[quiz.answer] : info.definition;
  const partOfSpeech = quiz ? (info.quizPartOfSpeech || info.partOfSpeech) : info.partOfSpeech;
  const showFlame = !!quiz && !!answer?.correct && !revealing && streak > 0;

  const pick = (i: number) => {
    if (!quiz || answer) return;
    const result = { picked: i, correct: i === quiz.answer };
    setAnswer(result);
    if (result.correct) setStreak((s) => s + 1); else setStreak(0);
    setRevealing(true);
    timer.current = setTimeout(() => setRevealing(false), REVEAL_MS);
    saveQuizAnswer(user?.id ?? null, dayKey, info.word, result).catch(() => {});
  };

  return (
    <WotdSection>
      <div className="px-3 py-2" style={CARD_STYLE}>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-black" style={{ color: 'var(--color-text)' }}>
            {info.word.charAt(0) + info.word.slice(1).toLowerCase()}
          </span>
          {info.phonetic && (
            <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>{info.phonetic}</span>
          )}
          {partOfSpeech && (
            <span className="text-[10px] font-extrabold italic" style={{ color: '#7c3aed' }}>{partOfSpeech}</span>
          )}
          {showFlame && (
            <span className="ml-auto flex items-center gap-0.5 text-[13px] font-black" style={{ color: '#c2410c' }} aria-label={`${streak}-day word streak`}>
              <Icon3D name="flame" size={14} />
              {streak}
            </span>
          )}
        </div>

        {asking && quiz && (
          <div className="mt-1.5 flex flex-col gap-1.5">
            <div className="text-[11px] font-extrabold" style={{ color: '#4b5563' }}>Which one is it?</div>
            {quiz.choices.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pick(i)}
                className="flex items-center gap-2 text-left px-2.5 py-1.5 transition-transform active:scale-[0.98]"
                style={{ minHeight: 44, border: '1.5px solid #ddd6fe', borderRadius: 10, background: 'var(--color-surface)' }}
              >
                <span className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-black" style={{ background: '#ede9fe', color: '#5b21b6' }}>
                  {LETTERS[i]}
                </span>
                <span className="text-[12px] font-bold leading-snug" style={{ color: 'var(--color-text)' }}>{c}</span>
              </button>
            ))}
          </div>
        )}

        {revealing && quiz && answer && (
          <div
            className="mt-1.5 flex items-center gap-2 px-2.5 py-2"
            style={{ borderRadius: 10, background: answer.correct ? '#dcfce7' : '#fee2e2' }}
            role="status"
          >
            <Sparkles className="w-5 h-5 shrink-0" style={{ color: answer.correct ? '#15803d' : '#b91c1c' }} />
            <div>
              <div className="text-[14px] font-black" style={{ color: answer.correct ? '#15803d' : '#b91c1c' }}>
                {answer.correct ? 'Nice! You knew it.' : 'Not this time.'}
              </div>
              <div className="text-[11px] font-extrabold" style={{ color: answer.correct ? '#15803d' : '#b91c1c' }}>
                {answer.correct
                  ? `Word streak: ${streak}`
                  : `You picked ${LETTERS[answer.picked]}. It's ${LETTERS[quiz.answer]}: ${quiz.choices[quiz.answer]}`}
              </div>
            </div>
          </div>
        )}

        {settled && !revealing && definition && (
          <p className="mt-1 text-[11px] font-bold leading-snug" style={{ color: '#4b5563' }}>{definition}</p>
        )}
      </div>
    </WotdSection>
  );
}
