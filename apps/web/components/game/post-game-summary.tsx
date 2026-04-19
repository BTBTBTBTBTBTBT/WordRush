'use client';

import { useWordDefinition } from '@/hooks/use-word-definition';

interface PostGameSummaryProps {
  solution: string;
}

/**
 * Dictionary-definition card rendered on the Classic post-completion
 * screen. Everything else (Solved line, Home / Share / Play Again) now
 * lives in the top header to match OctoWord / QuadWord / every other
 * mode — the definition is the one thing Classic adds.
 */
export function PostGameSummary({ solution }: PostGameSummaryProps) {
  const { definition, loaded } = useWordDefinition(solution);
  if (!loaded) return null;

  return (
    <div
      className="w-full max-w-[400px] mx-auto mt-3 px-3 py-2.5"
      style={{
        background: '#f8f7ff',
        borderRadius: '12px',
        border: '1px solid #ede9f6',
      }}
    >
      {definition ? (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {definition.phonetic && (
              <span className="text-xs font-medium" style={{ color: '#9ca3af' }}>
                {definition.phonetic}
              </span>
            )}
            {definition.partOfSpeech && (
              <span
                className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: '#ede9f6', color: '#a78bfa' }}
              >
                {definition.partOfSpeech}
              </span>
            )}
          </div>
          <p className="text-sm font-medium mt-1.5 leading-snug" style={{ color: '#4a4a6a' }}>
            {definition.definition}
          </p>
        </>
      ) : (
        <p className="text-xs font-medium italic" style={{ color: '#9ca3af' }}>
          No definition available for this word.
        </p>
      )}
    </div>
  );
}
