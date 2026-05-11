'use client';

interface TopWord {
  word: string;
  count: number;
  wins: number;
}

interface TopWordsCardProps {
  words: TopWord[];
  accentColor: string;
}

export function TopWordsCard({ words, accentColor }: TopWordsCardProps) {
  if (words.length === 0) return null;

  const maxCount = words[0]?.count || 1;

  return (
    <div
      className="overflow-hidden"
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
    >
      <div className="px-4 pt-3 pb-1">
        <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: accentColor }}>
          Most Played Words
        </div>
      </div>
      <div className="px-4 pb-3 space-y-1.5">
        {words.map((w, i) => {
          const barWidth = Math.max((w.count / maxCount) * 100, 8);
          const winRate = w.count > 0 ? Math.round((w.wins / w.count) * 100) : 0;
          return (
            <div key={w.word} className="flex items-center gap-2.5">
              <span
                className="text-[10px] font-black w-3 text-center shrink-0"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex gap-[3px]">
                    {w.word.split('').map((letter, li) => (
                      <div
                        key={li}
                        className="w-[22px] h-[22px] rounded-[4px] flex items-center justify-center text-[10px] font-black text-white"
                        style={{
                          background: accentColor,
                          opacity: 0.7 + (0.3 * (1 - i / Math.max(words.length - 1, 1))),
                        }}
                      >
                        {letter}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="h-[6px] rounded-full"
                      style={{
                        width: `${barWidth}%`,
                        background: `${accentColor}40`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0 flex items-center gap-2">
                <span className="text-[10px] font-black" style={{ color: 'var(--color-text)' }}>
                  {w.count}x
                </span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: winRate >= 50 ? 'var(--color-win-bg)' : 'var(--color-loss-bg)',
                    color: winRate >= 50 ? 'var(--color-win-text)' : 'var(--color-loss-text)',
                  }}
                >
                  {winRate}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
