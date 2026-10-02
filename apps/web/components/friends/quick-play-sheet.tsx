'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Radio, Swords } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { PageTitleText } from '@/components/ui/page-header';
import { COIN_STAKES, FRIENDLY_KINDS, FRIENDLY_TITLES, presenceLine, type FriendlyKind } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { challengeFriend, type FriendProfile } from '@/lib/friends-service';
import { startGame } from '@/lib/friendly-games-client';
import { vsHrefForMode } from '@/lib/invite-service';
import { FR, KIND_COLOR, KIND_SHORT, friendOnline, lastSeenMs, rivalryLine, sortForPicker } from '@/lib/friends-play';
import { FriendAvatar, GameGlyph, GameIconSquare, SectionLabel, Sheet } from './friends-ui';
import { GameSquare } from '@/components/ui/game-tile';
import { CandyButton, candyClass } from '@/components/ui/candy-button';
import { FR_LOOK, frBar, frSurface, rowStripe } from '@/lib/friends-look';
import { softMix } from '@/lib/soft-surface';

// The quick-play sheet (Friends overhaul §3): pick a pocket game (and a stake
// for Call It) or one of the two Wordocious ways to play, then INVITE. Opened
// from an ON NOW face, a Play pill, a game tile (with a friend picker) or a
// Rematch reaction. Finishing build (C4 / A1 / A8): tinted rows, chips and
// cards, candy Pick / Invite.

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
            <PageTitleText accent="friends" size={17} className="block">{FRIENDLY_TITLES[kind]}</PageTitleText>
            <div className="text-[11.5px] font-bold" style={{ color: FR.label }}>Pick a friend to play</div>
          </div>
        </div>
        <div className="overflow-hidden" style={frSurface(FR_LOOK.lavender, { radius: 16 })}>
          {ordered.map((f, i) => {
            const on = friendOnline(f, now);
            const line = presenceLine(lastSeenMs(f), f.activity ?? null, now);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFriend(f)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                style={{ background: rowStripe(i), borderTop: i === 0 ? undefined : `1px solid ${softMix(FR_LOOK.lavender, 0.1)}` }}
              >
                <FriendAvatar name={f.username} url={f.avatar_url} emoji={f.avatar_emoji} size={34} online={on} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-black truncate" style={{ color: FR_LOOK.ink }}>@{f.username}</span>
                  {line && <span className="block text-[11px] font-bold truncate" style={{ color: on ? '#047857' : FR_LOOK.rowSub }}>{line}</span>}
                </span>
                <span className={candyClass({ color: on ? 'pink' : 'peach', size: 'sm', extra: 'shrink-0' })}>
                  <span className="candy-label">Pick</span>
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
    onNote(`Challenge sent to ${friend.username}!`);
    router.push(`${vsHrefForMode('DUEL')}?inviteCode=${r.code}`);
  };

  const raceMyRun = () => router.push(isProActive ? `/vs/friend?friend=${friend.id}` : '/pro');

  return (
    <Sheet onClose={onClose} label={`Play with ${friend.username}`}>
      <div className="flex items-center gap-3 mb-4">
        <FriendAvatar name={friend.username} url={friend.avatar_url} emoji={friend.avatar_emoji} size={48} online={on} pulse={on} />
        <div className="flex-1 min-w-0">
          <PageTitleText accent="friends" size={17} className="block truncate">PLAY WITH @{friend.username}</PageTitleText>
          {presence && <div className="text-[11.5px] font-extrabold truncate" style={{ color: on ? FR.online : FR.label }}>{presence}</div>}
          {rivalry && <div className="text-[11px] font-bold truncate" style={{ color: FR.label }}>{rivalry}</div>}
        </div>
      </div>

      <SectionLabel>Quick games{on ? ' · live while they’re on' : ''}</SectionLabel>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {FRIENDLY_KINDS.map((k) => {
          const sel = k === kind;
          return (
            // Square game tile (docs/GAME_TILE_STYLE.md), selected = the picked game.
            <GameSquare
              key={k}
              accent={KIND_COLOR[k]}
              tone="light"
              selected={sel}
              glyph={<GameGlyph kind={k} size={16} color={KIND_COLOR[k]} stroke={2.2} />}
              label={KIND_SHORT[k]}
              onClick={() => setKind(k)}
              aria-pressed={sel}
              aria-label={KIND_SHORT[k]}
            />
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
                style={{
                  height: 30,
                  background: softMix(KIND_COLOR.coin, sel ? 0.24 : 0.12),
                  border: sel ? `2px solid ${KIND_COLOR.coin}` : `1.5px solid ${softMix(KIND_COLOR.coin, 0.32)}`,
                  boxShadow: sel ? `0 0 0 3px ${softMix(KIND_COLOR.coin, 0.22)}` : undefined,
                  color: sel ? '#713f12' : FR_LOOK.ink,
                }}
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
          className="relative overflow-hidden flex flex-col items-start gap-1 text-left disabled:opacity-60"
          style={{ ...frSurface(FR_LOOK.teal, { radius: 16, share: 0.16 }), padding: '16px 12px 12px' }}
        >
          <span aria-hidden="true" className="absolute top-0 left-0 right-0" style={frBar(FR_LOOK.teal, 6)} />
          <span className="flex items-center gap-1.5 text-[12.5px] font-black" style={{ color: FR.teal }}>
            {busy === 'vs' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />} VS Battle, live
          </span>
          <span className="text-[10.5px] font-bold" style={{ color: '#134e4a' }}>A private Classic match. Free for friends.</span>
        </button>
        <button
          type="button"
          onClick={raceMyRun}
          className="relative overflow-hidden flex flex-col items-start gap-1 text-left"
          style={{ ...frSurface(FR_LOOK.lavender, { radius: 16 }), padding: '16px 12px 12px' }}
        >
          <span aria-hidden="true" className="absolute top-0 left-0 right-0" style={frBar(FR_LOOK.lavender, 6)} />
          {!isProActive && <Icon3D name="crown" size={14} className="absolute top-3.5 right-2.5" />}
          <span className="flex items-center gap-1.5 text-[12.5px] font-black" style={{ color: '#6d28d9' }}>
            <Swords className="w-4 h-4" /> Race my run
          </span>
          <span className="text-[10.5px] font-bold" style={{ color: FR_LOOK.ink }}>You play first. They race your run. Pro.</span>
        </button>
      </div>

      {error && <p className="mt-3 text-[12px] font-bold text-center" style={{ color: '#dc2626' }}>{error}</p>}

      <CandyButton
        color="pink"
        block
        onClick={invite}
        disabled={busy !== null}
        icon={busy === 'invite' ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : 'play'}
        className="mt-4"
      >
        Invite to {FRIENDLY_TITLES[kind]}
      </CandyButton>
      <p className="mt-1 text-center text-[11px] font-bold" style={{ color: FR_LOOK.rowSub }}>
        {friend.username} gets a ping. If they&apos;re busy, it waits as your turn.
      </p>
    </Sheet>
  );
}
