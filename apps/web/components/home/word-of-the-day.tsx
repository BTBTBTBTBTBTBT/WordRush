'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Icon3D } from '@/components/ui/icon3d';
import { SOLUTIONS_CUTOVER_DATE, solutionSwapBatchesFor, applySolutionSwapBatches } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { fetchQuizState, saveQuizAnswer, type QuizAnswer } from '@/lib/home-streaks';
import { HomeSectionTitle } from '@/components/home/home-section-title';
import { GUIDE_BAR, GuideStage, ReadChip, guideCardStyle } from '@/components/strategy/guide-family';
import { LetterTile } from '@/components/game/letter-tile';
import { LiveHeadline } from '@/components/ui/live-headline';
import { SoftNum } from '@/components/ui/soft-number';
import { POSE_SIZE, poseSrc } from '@/lib/art';
import { accentInk, alphaHex } from '@/lib/soft-surface';

// Word of the Day, now a three-choice quiz (founder-approved home redesign,
// 2026-10-01). Before answering, the definition is hidden behind three choices
// (one real; /api/wotd picks the same two decoys for everyone each day). A tap
// shows a ~2 s right/wrong beat, then the card settles into the ordinary card
// with ONLY the real definition, plus a small flame and the word streak after a
// right answer. The wrong choices never come back that day.
//
// Art pass §12 + §19.2 (docs/ART_SPEC.md): the WORD OF THE DAY title art sits
// OUT of the card, as a centered Home section header above it (same size as
// DAILIES and PUZZLES), with a small "Past words" link centered under the
// title; the card keeps its content.
//
// FINISH_SPEC BI17 (3-platform parity): the card wears the guide page family's
// hero look (no stroke, rainbow bar, I-green glow). I's "ready" pose sits on a
// small glow beside the word in the live headline lettering; the choices are
// glossy candy tiles that stay up through the reveal (right = green, a wrong
// pick = rose, the rest fade). Answers survive a database outage
// (lib/wotd-quiz-history.ts via lib/home-streaks.ts).

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
  const w = list[dayIndex % list.length];
  const swapped = applySolutionSwapBatches([w.toUpperCase()], solutionSwapBatchesFor(dayKey))[0];
  return swapped === w.toUpperCase() ? w : swapped;
}

const LETTERS = ['A', 'B', 'C'];
/** I's green, the Word of the Day host (docs/ART_SPEC.md §21.5): the card's glow + gradient. */
const WOTD_ACCENT = '#4CC77A';
/** BI17: brand purple is the reading accent (eyebrow, part-of-speech chip). */
const READ_ACCENT = '#7C3AED';
/** Theme-aware inks (legible on the dark card): body gray, the purple eyebrow, the link. */
const BODY_INK = accentInk('#64748b', '#4b5563');
const EYEBROW_INK = accentInk(READ_ACCENT, '#6d28d9');
const LINK_INK = accentInk('#8b5cf6', '#8b5cf6');
/** The reveal's result line inks (green / rose; pastel on the dark card). */
const RIGHT_INK = accentInk('#34d399', '#047857');
const WRONG_INK = accentInk('#fb7185', '#be123c');

/**
 * FINISH_SPEC BI17: the guide hero card look (components/strategy/guide-family.tsx)
 * in place of the bordered Home card chrome — no stroke, the 8 px rainbow bar,
 * I-green gradient over cream, radius 24, one soft shadow.
 */
function WotdCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      data-squish="card"
      className="sg-card relative"
      style={guideCardStyle(WOTD_ACCENT, { radius: 20, hi: 0.16, lo: 0.05, hiDark: 0.24, loDark: 0.08, shadow: 0.18 })}
    >
      <div aria-hidden="true" style={{ height: 6, background: GUIDE_BAR }} />
      {/* BJ7: 12 padding (was 12 / 14 / 14). */}
      <div className={className} style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

/** The section: the header (title art, Past words under it) above the card. */
function WotdSection({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="Word of the Day">
      <HomeSectionTitle
        compact
        name="art-titlecast-wotd"
        label="Word of the Day"
        below={(
          <Link href="/words" className={`text-[10px] font-bold hover:underline ${LINK_INK.className}`} style={LINK_INK.style}>
            Past words →
          </Link>
        )}
      />
      {children}
    </section>
  );
}

/** One quiz choice: a glossy lilac candy tile (globals.css `.wq-tile`), no stroke. */
function QuizTile({ index, text, state, onPick }: {
  index: number;
  text: string;
  state: 'ask' | 'right' | 'wrong' | 'dim';
  onPick?: () => void;
}) {
  const lit = state === 'right' || state === 'wrong';
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!onPick}
      data-state={state}
      aria-label={`${LETTERS[index]}: ${text}`}
      className="wq-tile w-full flex items-center gap-2.5 text-left px-2.5 py-2"
    >
      <LetterTile
        letter={LETTERS[index]}
        look={state === 'right' ? 'correct' : 'typed'}
        pop={false}
        aria-hidden
        className="shrink-0"
        style={{ width: 28, ['--gt-font' as string]: '14px' }}
      />
      <span className="relative text-[14px] font-bold leading-snug" style={{ color: lit ? '#ffffff' : 'var(--color-text)' }}>{text}</span>
    </button>
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
      <WotdCard className="animate-pulse">
        <div className="flex items-center gap-3">
          <div className="shrink-0 rounded-full" style={{ width: 52, height: 52, background: alphaHex(WOTD_ACCENT, 0.22) }} />
          <div className="flex-1 min-w-0">
            <div className="h-6 w-32 rounded mb-1.5" style={{ background: 'var(--color-border)' }} />
            <div className="h-3 w-24 rounded" style={{ background: 'var(--color-border)' }} />
          </div>
        </div>
        <div className="h-3 w-48 rounded mt-3" style={{ background: 'var(--color-border)' }} />
      </WotdCard>
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

  const tileState = (i: number): 'right' | 'wrong' | 'dim' => {
    if (quiz && i === quiz.answer) return 'right';
    return answer && i === answer.picked ? 'wrong' : 'dim';
  };
  const resultInk = answer?.correct ? RIGHT_INK : WRONG_INK;

  return (
    <WotdSection>
      <WotdCard>
        {/* BJ7: one top line — I (44), the word and the streak top-aligned. */}
        <div className="flex items-start gap-2.5">
          <div className="shrink-0" style={{ marginLeft: -6, marginRight: -4 }}>
            <GuideStage host="i" accent={WOTD_ACCENT} size={44} />
          </div>
          <div className="flex-1 min-w-0">
            <LiveHeadline text={info.word} palette="home" size={22} align="left" level={3} />
            {(info.phonetic || partOfSpeech) && (
              <div className="mt-1 flex items-center gap-2 min-w-0">
                {info.phonetic && (
                  <span className="text-[13px] font-bold truncate" style={{ color: 'var(--color-text-secondary)' }}>{info.phonetic}</span>
                )}
                {partOfSpeech && <ReadChip accent={READ_ACCENT} size={10}>{partOfSpeech}</ReadChip>}
              </div>
            )}
          </div>
          {showFlame && (
            <span className="shrink-0 self-start flex items-center gap-0.5" aria-label={`${streak}-day word streak`}>
              <Icon3D name="flame" size={14} />
              <SoftNum size={13}>{streak}</SoftNum>
            </span>
          )}
        </div>

        {asking && quiz && (
          <div className="mt-3 flex flex-col gap-2">
            <div className={`text-[11px] font-black uppercase ${EYEBROW_INK.className}`} style={{ ...EYEBROW_INK.style, letterSpacing: '1.2px' }}>
              Which one is it?
            </div>
            {quiz.choices.map((c, i) => (
              <QuizTile key={i} index={i} text={c} state="ask" onPick={() => pick(i)} />
            ))}
          </div>
        )}

        {revealing && quiz && answer && (
          <div className="mt-3 flex flex-col gap-2">
            {quiz.choices.map((c, i) => (
              <QuizTile key={i} index={i} text={c} state={tileState(i)} />
            ))}
            <div
              className="flex items-center gap-2 px-2.5 py-2"
              style={{ borderRadius: 14, background: alphaHex(answer.correct ? '#34d399' : '#fb7185', 0.18) }}
              role="status"
            >
              <Image
                src={answer.correct ? poseSrc('o1', 'cheer') : poseSrc('r', 'sit')}
                alt=""
                aria-hidden
                width={POSE_SIZE}
                height={POSE_SIZE}
                sizes="40px"
                draggable={false}
                className="shrink-0"
                style={{ width: 40, height: 40 }}
              />
              <div className="min-w-0">
                <div className={`text-[14px] font-black ${resultInk.className}`} style={resultInk.style}>
                  {answer.correct ? 'Nice! You knew it.' : 'Not this time.'}
                </div>
                <div className={`text-[11px] font-extrabold ${resultInk.className}`} style={resultInk.style}>
                  {answer.correct
                    ? `Word streak: ${streak}`
                    : `You picked ${LETTERS[answer.picked]}. It's ${LETTERS[quiz.answer]}: ${quiz.choices[quiz.answer]}`}
                </div>
              </div>
            </div>
          </div>
        )}

        {settled && !revealing && definition && (
          <p className={`mt-2.5 text-[14px] font-bold leading-snug ${BODY_INK.className}`} style={BODY_INK.style}>{definition}</p>
        )}
      </WotdCard>
    </WotdSection>
  );
}
