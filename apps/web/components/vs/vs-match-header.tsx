'use client';

import { Crown } from 'lucide-react';

interface HeaderPlayer {
  username: string;
  avatarUrl: string | null;
  guesses: number;
  /** Normalized 0..1 lead metric — see computeVsProgress in vs-game. */
  progress: number;
}

interface VsMatchHeaderProps {
  me: HeaderPlayer;
  opponent: HeaderPlayer;
  opponentTyping: boolean;
}

function HeaderAvatar({ username, avatarUrl }: { username: string; avatarUrl: string | null }) {
  const initials = (username || '?').slice(0, 2).toUpperCase();
  return avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt={username}
      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
      style={{ border: '1.5px solid var(--color-border)' }}
    />
  ) : (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
      <span className="text-white font-black text-[10px]">{initials}</span>
    </div>
  );
}

/**
 * Persistent in-match header: you on the left, opponent on the right,
 * and a tug-of-war bar in the middle that fills toward whoever is ahead
 * (purple = you, pink = them). A crown marks the leading side.
 */
export function VsMatchHeader({ me, opponent, opponentTyping }: VsMatchHeaderProps) {
  // Boundary position: 50% when even; shifts by half the progress delta,
  // clamped so neither color ever fully disappears.
  const myShare = Math.min(0.9, Math.max(0.1, 0.5 + (me.progress - opponent.progress) / 2));
  const iLead = me.progress > opponent.progress + 0.001;
  const theyLead = opponent.progress > me.progress + 0.001;

  return (
    <div className="px-3 shrink-0">
      <div
        className="max-w-md mx-auto rounded-xl px-3 py-2"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          {/* You */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <HeaderAvatar username={me.username} avatarUrl={me.avatarUrl} />
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-extrabold truncate" style={{ color: 'var(--color-text)' }}>{me.username}</span>
                {iLead && <Crown className="w-3 h-3 flex-shrink-0" style={{ color: '#f59e0b' }} fill="currentColor" />}
              </div>
              <div className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                {me.guesses} {me.guesses === 1 ? 'guess' : 'guesses'}
              </div>
            </div>
          </div>

          {/* Opponent */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end text-right">
            <div className="min-w-0">
              <div className="flex items-center gap-1 justify-end">
                {theyLead && <Crown className="w-3 h-3 flex-shrink-0" style={{ color: '#f59e0b' }} fill="currentColor" />}
                <span className="text-[11px] font-extrabold truncate" style={{ color: 'var(--color-text)' }}>{opponent.username}</span>
              </div>
              <div className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                {opponent.guesses} {opponent.guesses === 1 ? 'guess' : 'guesses'}
              </div>
            </div>
            <HeaderAvatar username={opponent.username} avatarUrl={opponent.avatarUrl} />
          </div>
        </div>

        {/* Tug-of-war bar */}
        <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--color-border)' }}>
          <div
            className="h-full rounded-l-full"
            style={{
              width: `${myShare * 100}%`,
              background: 'linear-gradient(90deg, #a78bfa, #7c3aed)',
              transition: 'width 500ms ease',
            }}
          />
          <div
            className="h-full flex-1 rounded-r-full"
            style={{ background: 'linear-gradient(90deg, #ec4899, #f472b6)', transition: 'width 500ms ease' }}
          />
        </div>

        {/* Typing indicator — visible while opponent pings arrive */}
        {opponentTyping && (
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[9px] font-bold" style={{ color: '#ec4899' }}>
              {opponent.username} is typing
            </span>
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full animate-pulse"
                  style={{ background: '#ec4899', animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
