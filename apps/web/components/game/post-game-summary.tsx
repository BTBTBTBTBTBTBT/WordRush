'use client';

import { useWordDefinition } from '@/hooks/use-word-definition';
import { LetterTile } from '@/components/game/letter-tile';
import { cardBarStyle } from '@/lib/soft-surface';

interface PostGameSummaryProps {
  solution: string;
}

/** The "Today's word" card's green. */
const WORD_GREEN = '#22a866';

/**
 * Today's word on the finished screen (docs/FINISH_SPEC.md B6; mockup
 * finishing-touches.html): the word spelled in purple tiles on a soft green
 * card with a green top bar, a green part-of-speech chip and the dictionary
 * definition. Everything else (the result pills, Share, Play Again) lives in
 * the header above the board.
 */
export function PostGameSummary({ solution }: PostGameSummaryProps) {
  const { definition, loaded } = useWordDefinition(solution);
  if (!loaded) return null;
  const letters = solution.toUpperCase().split('');
  const tile = letters.length > 6 ? 30 : 34;

  return (
    <div
      className="w-full max-w-[400px] mx-auto mt-3 overflow-hidden"
      style={{
        background: 'linear-gradient(#22a86614, #22a86614), var(--color-card-base, #ffffff)',
        border: '1.5px solid #c9efda',
        borderRadius: 20,
        boxShadow: '0 8px 20px rgba(60, 30, 110, 0.10)',
      }}
    >
      <div aria-hidden="true" style={{ ...cardBarStyle(WORD_GREEN), background: 'linear-gradient(90deg, #22a866, #5ed59a)' }} />
      <div className="px-3.5 pt-2.5 pb-3 grid gap-2">
        <div className="text-[11px] font-black uppercase" style={{ letterSpacing: '0.12em', color: '#137a3d' }}>
          Today&rsquo;s word
        </div>
        <div className="flex justify-center" style={{ gap: 5, ['--gt-font' as string]: `${Math.round(tile * 0.58)}px` } as React.CSSProperties} role="img" aria-label={solution.toUpperCase()}>
          {letters.map((ch, i) => (
            <LetterTile key={i} letter={ch} look="correct" pop={false} style={{ width: tile, height: tile }} aria-hidden />
          ))}
        </div>
        {definition ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              {definition.partOfSpeech && (
                <span
                  className="text-[11px] font-black uppercase text-white rounded-full"
                  style={{ letterSpacing: '0.1em', padding: '3px 10px', background: 'linear-gradient(#5ed59a, #22a866)', boxShadow: '0 2px 0 #157a48' }}
                >
                  {definition.partOfSpeech}
                </span>
              )}
              {definition.phonetic && (
                <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  {definition.phonetic}
                </span>
              )}
            </div>
            <p className="m-0 text-sm font-bold leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
              {definition.definition}
            </p>
          </>
        ) : (
          <p className="m-0 text-xs font-bold italic" style={{ color: 'var(--color-text-muted)' }}>
            No definition available for this word.
          </p>
        )}
      </div>
    </div>
  );
}
