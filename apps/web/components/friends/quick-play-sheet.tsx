'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Loader2, Radio, Swords } from 'lucide-react';
import { COIN_STAKES, FRIENDLY_KINDS, FRIENDLY_TITLES, presenceLine, type FriendlyKind } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { challengeFriend, type FriendProfile } from '@/lib/friends-service';
import { startGame } from '@/lib/friendly-games-client';
import { vsHrefForMode } from '@/lib/invite-service';
import { FR, KIND_SHORT, friendOnline, lastSeenMs, rivalryLine, sortForPicker } from '@/lib/friends-play';
import { FriendAvatar, GameIconSquare, SectionLabel, Sheet, cardStyle } from './friends-ui';

// The quick-play sheet (Friends overhaul §3): pick a pocket game (and a stake
// for Call It) or one of the two Wordocious ways to play, then INVITE. Opened
// from an ON NOW face, a Play pill, a game tile (with a friend picker) or a
// Rematch reaction.

interface Props {
  friends: FriendProfile[];
  /** Preselected friend; null shows the picker first. */
  friend: FriendProfile | null;
  kind: FriendlyKind;
  onClose: () => void;
  onNote: (text: string) => void;
}

export function QuickPlaySheet({ friends, friend: initialFriend, kind: initialKind, onClose, onNote }: Props) {
  const router = useRouter();
  const { isProActive } = useAuth();
  const [friend, setFriend] = useState<FriendProfile | null>(initialFriend);
  const [kind, setKind] = useState<FriendlyKind>(initialKind);
  const [stake, setStake] = useState<string>(COIN_STAKES[0]);
  const [busy, setBusy] = useState<'invite' | 'vs' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();

  if (!friend) {
    const ordered = sortForPicker(friends, now);
    return (
      <Sheet onClose={onClose} label="Pick a friend">
        <div className="flex items-center gap-2 mb-3">
          <GameIconSquare kind={kind} size={36} />
          <div className="min-w-0">
            <div className="text-[17px] font-black uppercase" style={{ color: FR.ink, letterSpacing: 0.3 }}>{FRIENDLY_TITLES[kind]}</div>
            <div className="text-[11.5px] font-bold" style={{ color: FR.label }}>Pick a friend to play</div>
          </div>
        </div>
        <div style={cardStyle}>
          {ordered.map((f, i) => {
            const on = friendOnline(f, now);
            const line = presenceLine(lastSeenMs(f), f.activity ?? null, now);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFriend(f)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                style={{ borderTop: i === 0 ? undefined : '1px solid #f1f5f9' }}
              >
                <FriendAvatar name={f.username} url={f.avatar_url} emoji={f.avatar_emoji} size={34} online={on} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-black truncate" style={{ color: FR.text }}>@{f.username}</span>
                  {line && <span className="block text-[11px] font-bold truncate" style={{ color: on ? FR.online : FR.label }}>{line}</span>}
                </span>
                <span className="shrink-0 px-3 flex items-center text-[11px] font-black rounded-full" style={{ height: 28, background: on ? FR.solid : FR.soft, color: on ? '#ffffff' : FR.mid }}>
                  Pick
                </span>
              </button>
            );
          })}
        </div>
      </Sheet>
    );
  }

  const on = friendOnline(friend, now);
  const presence = presenceLine(lastSeenMs(friend), friend.activity ?? null, now);
  const rivalry = rivalryLine(friend);

  const invite = async () => {
    if (busy) return;
    setBusy('invite');
    setError(null);
    const r = await startGame(kind, friend.id, kind === 'coin' ? stake : undefined);
    if ('error' in r) { setError(r.error); setBusy(null); return; }
    router.push(`/friends/games/${r.game.id}`);
  };

  const vsLive = async () => {
    if (busy) return;
    setBusy('vs');
    const r = await challengeFriend(friend.id, 'DUEL');
    if ('error' in r) { setError(r.error); setBusy(null); return; }
    onNote(`Challenge sent to ${friend.username} ⚔️`);
    router.push(`${vsHrefForMode('DUEL')}?inviteCode=${r.code}`);
  };

  const raceMyRun = () => router.push(isProActive ? `/vs/friend?friend=${friend.id}` : '/pro');

  return (
    <Sheet onClose={onClose} label={`Play with ${friend.username}`}>
      <div className="flex items-center gap-3 mb-4">
        <FriendAvatar name={friend.username} url={friend.avatar_url} emoji={friend.avatar_emoji} size={48} online={on} pulse={on} />
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-black uppercase truncate" style={{ color: FR.ink, letterSpacing: 0.3 }}>PLAY WITH @{friend.username}</div>
          {presence && <div className="text-[11.5px] font-extrabold truncate" style={{ color: on ? FR.online : FR.label }}>{presence}</div>}
          {rivalry && <div className="text-[11px] font-bold truncate" style={{ color: FR.label }}>{rivalry}</div>}
        </div>
      </div>

      <SectionLabel>Quick games{on ? ' · live while they’re on' : ''}</SectionLabel>
      <div className="grid grid-cols-4 gap-2 mt-2">
        {FRIENDLY_KINDS.map((k) => {
          const sel = k === kind;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={sel}
              className="flex flex-col items-center gap-1.5 py-2.5 px-1 transition-transform active:scale-95"
              style={{ ...cardStyle, boxShadow: sel ? `0 0 0 2px ${FR.solid}, ${FR.cardShadow}` : FR.cardShadow }}
            >
              <GameIconSquare kind={k} size={34} />
              <span className="text-[10.5px] font-black text-center leading-tight" style={{ color: FR.text }}>{KIND_SHORT[k]}</span>
            </button>
          );
        })}
      </div>

      {kind === 'coin' && (
        <div className="flex flex-wrap gap-1.5 mt-3" role="group" aria-label="What's on the line">
          {COIN_STAKES.map((s) => {
            const sel = s === stake;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStake(s)}
                aria-pressed={sel}
                className="px-3 text-[11px] font-black rounded-full"
                style={{ height: 28, background: '#ffffff', color: sel ? FR.ink : FR.label, boxShadow: sel ? `0 0 0 2px ${FR.solid}` : FR.cardShadow }}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4"><SectionLabel>Wordocious</SectionLabel></div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button
          type="button"
          onClick={vsLive}
          disabled={busy !== null}
          className="flex flex-col items-start gap-1 p-3 text-left transition-transform active:scale-[0.98] disabled:opacity-60"
          style={{ ...cardStyle, background: FR.teal }}
        >
          <span className="flex items-center gap-1.5 text-[12.5px] font-black text-white">
            {busy === 'vs' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />} VS Battle, live
          </span>
          <span className="text-[10.5px] font-bold" style={{ color: '#ccfbf1' }}>A private Classic match. Free for friends.</span>
        </button>
        <button
          type="button"
          onClick={raceMyRun}
          className="relative flex flex-col items-start gap-1 p-3 text-left transition-transform active:scale-[0.98]"
          style={{ ...cardStyle, background: FR.tealSoft }}
        >
          {!isProActive && <Crown className="absolute top-2.5 right-2.5 w-3.5 h-3.5" style={{ color: FR.teal }} />}
          <span className="flex items-center gap-1.5 text-[12.5px] font-black" style={{ color: FR.teal }}>
            <Swords className="w-4 h-4" /> Race my run
          </span>
          <span className="text-[10.5px] font-bold" style={{ color: '#134e4a' }}>You play first. They race your run. Pro.</span>
        </button>
      </div>

      {error && <p className="mt-3 text-[12px] font-bold text-center" style={{ color: '#dc2626' }}>{error}</p>}

      <button
        type="button"
        onClick={invite}
        disabled={busy !== null}
        className="w-full mt-4 py-3 flex items-center justify-center gap-2 text-[15px] font-black text-white uppercase transition-transform active:scale-[0.98] disabled:opacity-60"
        style={{ background: FR.solid, borderRadius: 14, letterSpacing: 0.6 }}
      >
        {busy === 'invite' && <Loader2 className="w-4 h-4 animate-spin" />}
        Invite to {FRIENDLY_TITLES[kind]}
      </button>
      <p className="mt-2 text-center text-[11px] font-bold" style={{ color: FR.label }}>
        {friend.username} gets a ping. If they&apos;re busy, it waits as your turn.
      </p>
    </Sheet>
  );
}
